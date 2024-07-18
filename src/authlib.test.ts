import {
  _internal,
  AuthCode,
  mkAuthCodeRequest,
  mkTokenRequest,
  wellKnownKeycloak,
} from "./authlib";

import fetchMock from "fetch-mock";

const { generateCodeChallenge } = _internal;

describe("Logging In", () => {
  describe("wellKnownKeycloak", () => {
    it("should return the well-known endpoints", async () => {
      const wellKnownPath =
        "http://localhost:8888/realms/kb/.well-known/openid-configuration";
      fetchMock.mock(wellKnownPath, {
        status: 200,
        body: {
          authorization_endpoint:
            "https://keycloak.example.com/auth/realms/master/protocol/openid-connect/auth",
          token_endpoint:
            "https://keycloak.example.com/auth/realms/master/protocol/openid-connect/token",
          end_session_endpoint:
            "https://keycloak.example.com/auth/realms/master/protocol/openid-connect/logout",
        },
      });

      const wellKnownEndpoints = await wellKnownKeycloak(
        "http://localhost:8888",
        "kb",
      );

      expect(wellKnownEndpoints).toEqual({
        authorization_endpoint:
          "https://keycloak.example.com/auth/realms/master/protocol/openid-connect/auth",
        token_endpoint:
          "https://keycloak.example.com/auth/realms/master/protocol/openid-connect/token",
        end_session_endpoint:
          "https://keycloak.example.com/auth/realms/master/protocol/openid-connect/logout",
      });
    });
  });

  describe("mkAuthCodeRequest", () => {
    const authUrl =
      "http://localhost:8888/realms/kb/protocol/openid-connect/auth";
    const redirectUrl = "http://localhost:8080/api/signin/callback";
    const clientId = "oauth2-kata";
    const authCode: AuthCode = { state: "blakeks", codeVerifier: "abc123" };

    const mkTestRequest = () =>
      mkAuthCodeRequest(authUrl, redirectUrl, clientId, authCode);

    it("should return a Request object", () => {
      expect(mkTestRequest()).toBeInstanceOf(Request);
    });

    it("should contain correct method, domain and path", () => {
      const request = mkTestRequest();
      const url = new URL(request.url);

      expect(url.origin).toBe("http://localhost:8888");
      expect(url.pathname).toBe("/realms/kb/protocol/openid-connect/auth");
      expect(request.method).toBe("GET");
    });

    it("should contain necessary query parameters", () => {
      const request = mkTestRequest();
      const url = new URL(request.url);
      const searchParams = new URLSearchParams(url.search);

      expect(searchParams.get("response_type")).toBe("code");
      expect(searchParams.get("client_id")).toBe(clientId);
      expect(searchParams.get("state")).toBe("blakeks");
      expect(searchParams.get("redirect_uri")).toBe(redirectUrl);
      expect(searchParams.get("code_challenge")).toBeDefined();
      expect(searchParams.get("code_challenge_method")).toBe("S256");
      expect(searchParams.get("scope")).toBe("openid");
    });

    it("should generate code challenge", () => {
      const request = mkTestRequest();
      const url = new URL(request.url);
      const searchParams = new URLSearchParams(url.search);

      expect(searchParams.get("code_challenge")).toBe(
        generateCodeChallenge(authCode.codeVerifier),
      );
    });

    it("should correctly encode the redirect URL", () => {
      const request = mkTestRequest();
      const url = new URL(request.url);

      expect(url.search).toContain(
        "redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Fapi%2Fsignin%2Fcallback",
      );
    });
  });

  describe("mkTokenRequest", () => {
    const tokenUrl =
      "http://localhost:8888/realms/kb/protocol/openid-connect/token";
    const code = "abc123";
    const codeVerifier = "def456";
    const clientId = "oauth2-kata";
    const clientSecret = "super-secret";
    const redirectUrl = "http://localhost:8080/api/signin/callback";

    const mkTestRequest = () =>
      mkTokenRequest(
        tokenUrl,
        redirectUrl,
        clientId,
        clientSecret,
        code,
        codeVerifier,
      );

    it("should return a Request object", () => {
      const request = mkTestRequest();

      expect(request).toBeInstanceOf(Request);
    });

    it("should contain correct method, domain and path", () => {
      const request = mkTestRequest();
      const url = new URL(request.url);

      expect(url.origin).toBe("http://localhost:8888");
      expect(url.pathname).toBe("/realms/kb/protocol/openid-connect/token");
      expect(request.method).toBe("POST");
    });

    it("should contain necessary headers", () => {
      const request = mkTestRequest();

      expect(request.headers.get("Content-Type")).toBe(
        "application/x-www-form-urlencoded",
      );
    });

    it("should contain necessary body parameters", async () => {
      const request = mkTestRequest();
      const body = await request.formData();

      expect(body.get("grant_type")).toBe("authorization_code");
      expect(body.get("redirect_uri")).toBe(redirectUrl);
      expect(body.get("client_id")).toBe(clientId);
      expect(body.get("client_secret")).toBe(clientSecret);
      expect(body.get("code_verifier")).toBe(codeVerifier);
      expect(body.get("code")).toBe(code);
    });

    it("should correctly encode the redirect URL", async () => {
      const request = mkTestRequest();
      const body = await request.text();

      expect(body).toContain(
        "redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Fapi%2Fsignin%2Fcallback",
      );
    });
  });
});
