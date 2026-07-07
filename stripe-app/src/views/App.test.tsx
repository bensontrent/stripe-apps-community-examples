import { getMockContextProps, render } from "@stripe/ui-extension-sdk/testing";
import { Badge, Banner, Button, Link } from "@stripe/ui-extension-sdk/ui";

import {
  BackendConnectionError,
  createDownloadLink,
  getMe,
} from "../api/backend";
import App from "./App";

// Keep the real BackendConnectionError export — the view's `instanceof`
// check needs the actual class, not a mock.
jest.mock("../api/backend", () => ({
  ...jest.requireActual("../api/backend"),
  getMe: jest.fn(),
  createDownloadLink: jest.fn(),
}));

const mockGetMe = getMe as jest.MockedFunction<typeof getMe>;
const mockCreateDownloadLink = createDownloadLink as jest.MockedFunction<
  typeof createDownloadLink
>;

describe("App", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("verifies the backend connection with a signed request", async () => {
    mockGetMe.mockResolvedValue({
      accountId: "acct_123",
      userId: "usr_456",
      mode: "test",
      authType: "stripe-signature",
      message: "Signed Stripe App request verified by the proxy.",
    });

    const context = getMockContextProps();
    const { wrapper, update } = render(<App {...context} />);

    const [verifyButton] = wrapper.findAll(Button);
    verifyButton.trigger("onPress", { type: "press" });
    await update();

    expect(mockGetMe).toHaveBeenCalledTimes(1);
    const badge = wrapper.find(Badge);
    expect(badge).toBeTruthy();
    expect(badge!.text).toContain("stripe-signature");
  });

  it("shows an error banner when the backend is unreachable", async () => {
    mockGetMe.mockRejectedValue(new Error("Failed to fetch"));

    const { wrapper, update } = render(<App {...getMockContextProps()} />);

    const [verifyButton] = wrapper.findAll(Button);
    verifyButton.trigger("onPress", { type: "press" });
    await update();

    const banners = wrapper.findAll(Banner);
    const errorBanner = banners.find(
      (banner) => banner.props.type === "critical",
    );
    expect(errorBanner).toBeTruthy();
    expect(errorBanner!.props.description).toContain("Failed to fetch");
  });

  it("shows the setup hint from a BackendConnectionError", async () => {
    mockGetMe.mockRejectedValue(
      new BackendConnectionError(
        "Couldn't get a Stripe signature: No such app: com.example.demo",
        "Run `stripe apps upload` once from stripe-app/.",
      ),
    );

    const { wrapper, update } = render(<App {...getMockContextProps()} />);

    const [verifyButton] = wrapper.findAll(Button);
    verifyButton.trigger("onPress", { type: "press" });
    await update();

    const banners = wrapper.findAll(Banner);
    const errorBanner = banners.find(
      (banner) => banner.props.type === "critical",
    );
    expect(errorBanner!.props.description).toContain("No such app");
    expect(wrapper.text).toContain("stripe apps upload");
  });

  it("creates a self-authenticating download link", async () => {
    mockCreateDownloadLink.mockResolvedValue({
      token: "jwt-token",
      expiresIn: "15m",
      url: "http://localhost:3006/api/public/download?token=jwt-token&account=acct_123",
    });

    const { wrapper, update } = render(<App {...getMockContextProps()} />);

    const [, createLinkButton] = wrapper.findAll(Button);
    createLinkButton.trigger("onPress", { type: "press" });
    await update();

    expect(mockCreateDownloadLink).toHaveBeenCalledTimes(1);
    const link = wrapper.find(Link);
    expect(link).toBeTruthy();
    expect(link!.props.href).toContain("/api/public/download?token=");
  });
});
