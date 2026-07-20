// views/App.tsx
//
// ============================================================================
//  Backend connection demo — Stripe App ⇄ Next.js backend
// ============================================================================
//
// This drawer view demonstrates the two client-side halves of the auth
// framework documented in nextjs-backend/AUTHENTICATION.md:
//
//   1. Signed requests — every fetch in src/api/backend.ts carries a
//      `stripe-signature` header from fetchStripeSignature(). The backend
//      proxy verifies it against the app's signing secret, so no login or
//      API key is needed. "Verify connection" round-trips one and shows
//      the identity the backend derived from the verified headers.
//
//   2. JWT-in-URL tokens — "Create download link" exchanges a signed
//      request for a short-lived URL that authenticates itself via its
//      query string. Open it in a new tab: the browser has no session or
//      headers, yet the route-level check passes.
//
//   3. User login — the Login component links this dashboard user to a
//      Better Auth account on the backend via a browser-tab handshake
//      (see src/components/Login.tsx for the full story).
//
// Run the backend first: `npm run dev` in nextjs-backend (localhost:3006).
// Local previews via `stripe apps start` may fetch localhost; uploaded
// apps can only reach the URLs listed in stripe-app.json's connect-src.
// ============================================================================

import type { ExtensionContextValue } from "@stripe/ui-extension-sdk/context";
import {
  Badge,
  Banner,
  Box,
  Button,
  ContextView,
  Divider,
  Icon,
  Inline,
  Link,
  Spinner,
} from "@stripe/ui-extension-sdk/ui";
import { useCallback, useState } from "react";
import {
  BackendConnectionError,
  createDownloadLink,
  getMe,
  MeResponse,
  UrlTokenResponse,
} from "../api/backend";
import Login from "../components/Login";
import BrandIcon from "./brand_icon.svg";

// One state machine per demo section: idle → loading → success | error.
type RequestState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; message: string; hint?: string };

const toErrorState = (error: unknown) =>
  ({
    status: "error",
    message: error instanceof Error ? error.message : String(error),
    hint: error instanceof BackendConnectionError ? error.hint : undefined,
  }) as const;

// Failed request banner + the phase-specific setup hint from backend.ts
// (missing upload, backend not running, env var mismatch, ...).
const RequestError = ({ message, hint }: { message: string; hint?: string }) => (
  <Box css={{ stack: "y", gap: "xsmall" }}>
    <Banner type="critical" title="Request failed" description={message} />
    {hint && (
      <Box css={{ font: "caption", color: "secondary" }}>💡 {hint}</Box>
    )}
  </Box>
);

const App = (context: ExtensionContextValue) => {
  const [me, setMe] = useState<RequestState<MeResponse>>({ status: "idle" });
  const [link, setLink] = useState<RequestState<UrlTokenResponse>>({
    status: "idle",
  });

  const runGetMe = useCallback(async () => {
    setMe({ status: "loading" });
    try {
      setMe({ status: "success", data: await getMe(context) });
    } catch (error) {
      setMe(toErrorState(error));
    }
  }, [context]);

  const runCreateLink = useCallback(async () => {
    setLink({ status: "loading" });
    try {
      setLink({ status: "success", data: await createDownloadLink(context) });
    } catch (error) {
      setLink(toErrorState(error));
    }
  }, [context]);

  return (
    <ContextView
      title="Backend connection"
      brandColor="#334"
      brandIcon={BrandIcon}
      externalLink={{
        label: "See documentation",
        href: "https://github.com/bensontrent/stripe-apps-community-examples/", // point at your repo's AUTHENTICATION.md
      }}
    >
      <Box css={{ stack: "y", gap: "medium" }}>
        <Banner
          type="default"
          title="Local demo"
          description="Start the backend first: npm run dev in nextjs-backend (localhost:3006)."
        />

        {/* ------------------------------------------------------------- */}
        {/*  1. Signed request                                             */}
        {/* ------------------------------------------------------------- */}
        <Box css={{ stack: "y", gap: "small" }}>
          <Inline css={{ font: "heading" }}>1. Signed request</Inline>
          <Box css={{ color: "secondary", font: "caption" }}>
            Sends a fetch with a stripe-signature header. The backend proxy
            verifies the Stripe Signature and echoes back who you are — no login, no API
            key.
          </Box>

          <Button
            type="primary"
            onPress={runGetMe}
            disabled={me.status === "loading"}
          >
            Verify connection
          </Button>

          {me.status === "loading" && <Spinner size="small" />}

          {me.status === "success" && (
            <Box
              css={{
                stack: "y",
                gap: "xsmall",
                padding: "medium",
                backgroundColor: "container",
                borderRadius: "small",
              }}
            >
              <Box css={{ stack: "x", gap: "small", alignY: "center" }}>
                <Icon name="check" size="xsmall" />
                <Inline css={{ fontWeight: "semibold" }}>
                  Verified by the proxy
                </Inline>
                <Badge type="positive">{me.data.authType}</Badge>
              </Box>
              <Box css={{ font: "caption" }}>
                Account: {me.data.accountId ?? "—"}
              </Box>
              <Box css={{ font: "caption" }}>
                User: {me.data.userId ?? "—"}
              </Box>
              <Box css={{ font: "caption" }}>Mode: {me.data.mode ?? "—"}</Box>
            </Box>
          )}

          {me.status === "error" && (
            <RequestError message={me.message} hint={me.hint} />
          )}
        </Box>

        <Divider />

        {/* ------------------------------------------------------------- */}
        {/*  2. JWT-in-URL token                                           */}
        {/* ------------------------------------------------------------- */}
        <Box css={{ stack: "y", gap: "small" }}>
          <Inline css={{ font: "heading" }}>2. Link that carries its own auth</Inline>
          <Box css={{ color: "secondary", font: "caption" }}>
            Exchanges a signed request for a short-lived URL bound to this
            Stripe account. Open it in a new tab — the browser sends no
            headers or cookies, yet the route verifies the token in the query
            string.
          </Box>

          <Button
            type="secondary"
            onPress={runCreateLink}
            disabled={link.status === "loading"}
          >
            Create download link
          </Button>

          {link.status === "loading" && <Spinner size="small" />}

          {link.status === "success" && (
            <Box
              css={{
                stack: "y",
                gap: "xsmall",
                padding: "medium",
                backgroundColor: "container",
                borderRadius: "small",
              }}
            >
              <Box css={{ font: "caption" }}>
                Expires in {link.data.expiresIn}
              </Box>
              <Link href={link.data.url} target="_blank" external>
                Open the authenticated link
              </Link>
            </Box>
          )}

          {link.status === "error" && (
            <RequestError message={link.message} hint={link.hint} />
          )}
        </Box>

        <Divider />

        {/* ------------------------------------------------------------- */}
        {/*  3. User login                                                 */}
        {/* ------------------------------------------------------------- */}
        <Box css={{ stack: "y", gap: "small" }}>
          <Inline css={{ font: "heading" }}>3. Log in as an app user</Inline>
          <Box css={{ color: "secondary", font: "caption" }}>
            Opens the backend&apos;s login page in a browser tab and links
            this dashboard user to a Better Auth account. The app itself
            never sees a cookie or password — after the handshake, signed
            requests alone identify the user.
          </Box>

          <Login context={context} />
        </Box>
      </Box>
    </ContextView>
  );
};

export default App;
