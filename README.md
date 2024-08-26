# OAuth2 Kata

<!-- toc -->

- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Starting the Application](#starting-the-application)
  - [Getting to Know Keycloak](#getting-to-know-keycloak)
- [The Goal](#the-goal)
- [Code Overview](#code-overview)
- [Logging In](#logging-in)
- [Exchanging the Code for Tokens](#exchanging-the-code-for-tokens)
- [Establishing a Session](#establishing-a-session)
- [Protecting the Secret Page](#protecting-the-secret-page)
- [Logging Out](#logging-out)
- [Clearing the Session](#clearing-the-session)

<!-- tocstop -->

## Getting Started

### Prerequisites

- Node.js version 20 or higher
- Docker and Docker Compose

### Installation

1. Clone the repository.
2. Run `npm install`.

### Starting the Application

1. Run `npm start` or `npm dev` to start the application.
2. Open `http://localhost:8080` in your browser.
3. You should see the home page.
4. You should be able to access the `Secret Page` without providing any credentials.

### Getting to Know Keycloak

1. Start the Keycloak server by running `docker-compose up` inside the `./auth-server` directory.
2. Navigate to `http://localhost:8888` in your browser.
3. A login modal should appear.
4. Use the following credentials to log in as admin:
   - Username: `admin`
   - Password: `password`
5. Select `kb` in the realm selector.
6. Navigate to `Clients > oauth2-kata`. This is the client we are using in our application:
   - Under `Settings`, you can see the Client ID as well as the configured redirect and post-logout URIs.
   - Under `Credentials`, you can find the super secret client secret.

## The Goal

1. Implement OAuth2 Authorization Code Flow for logging in.
2. Establish a session between the client and the server.
3. Protect the `Secret Page` so that only authenticated users can access it.
4. Implement a logout feature.

Follow the instructions below and ensure all tests pass.

## Code Overview

- The application has minimal runtime dependencies, using only `zod` and `winston` for logging.
- You need to implement the goals using plain TypeScript and Node.js.
- Directory structure:
  - [auth-server](auth-server): Contains the Keycloak server configuration.
  - [public](public): Contains the static files for the application.
  - [src](src): Contains the server code.
    - [ragettp](src/ragettp): Contains a naive implementation of an HTTP server.
    - [test.ts](src/test.ts): Contains the tests.
    - [authlib](src/authlib/authlib.ts): This is where you'll add the OAuth2 logic.
    - [api.ts](src/api.ts): Contains the API endpoints.

**Important**: You will only need to modify the `authlib` and `api.ts` files.

## Logging In

To log in a user when they click on the `Login` button, you need to create an endpoint that redirects the user to the Keycloak login page with the correct parameters.

After logging in, Keycloak redirects the user back to the client with an authorization code. This code is short-lived and can only be exchanged by the client that initiated the login process. We’ll handle this exchange in the next step. For now:

1. Implement `wellKnownKeycloak` in `authlib`.
   - Visit `http://localhost:8888/realms/kb/.well-known/openid-configuration` to understand what a well-known endpoint is.
   - Check `tests.ts` to understand the expected behavior.
2. Implement `mkAuthCodeRequest` in `authlib`.
   - Use `generateCodeChallenge` to generate the code challenge.
   - Use `URLSearchParams` to correctly encode the query parameters.
3. Create a new `GET` endpoint `/api/signin` in `api.ts` which:
   - Fetches the well-known endpoints using `wellKnownKeycloak`.
   - Generates a new `state` and `codeVerifier`, storing them in the session by calling `createAuthCode` with the correct redirect URL.
     - The redirect endpoint will be implemented in the next step. Use `http://localhost:8080/api/signin/callback` as the redirect URL.
   - Constructs a request where:
     - `authUrl`: `wellKnown.authorization_endpoint`
     - `redirectUrl`: Refer to Keycloak settings (there is only one redirect URL).
     - `clientId`: Refer to Keycloak settings.
   - Returns a `307` status code and redirects the user to the Keycloak login page URL.
     - Use the `Location` header to set the redirect URL.

To test your implementation:

1. Start the application with `npm start`.
2. Open `http://localhost:8080` in your browser and click the `Login` button. You can also directly navigate to `http://localhost:8080/api/signin`.
3. You should be successfully redirected to the Keycloak login page without any warnings or errors.
4. Log in with the following credentials:
   - Username: `testuser`
   - Password: `password`
5. On successful login, you should see the page indefinitely loading.
   - This happens because the browser is waiting for a response from `http://localhost:8080/api/signin`, but this endpoint does not exist yet.
   - If you inspect the network tab in your browser’s developer tools, you’ll see a 404 response.

The next step is to complete the login process by implementing the callback endpoint.

## Exchanging the Code for Tokens

The login process isn’t complete yet. After the user logs in, Keycloak redirects them back to the client with an authorization code. This code needs to be exchanged for an access token and an ID token. The access token is used to authenticate the user with the server, while the ID token contains information about the user.

Only known clients can exchange the code for tokens. The client needs to provide the client ID, client secret, and the authorization code. You’ve already seen the super secret client secret in the Keycloak settings.

1. Implement `mkTokenRequest` in `authlib`.
   - Refer to [src/tests.ts](src/test.ts) to understand the expected behavior.
2. Implement the `GET` endpoint `/api/signin/callback`:
   1. Fetch well-known endpoints using `wellKnownKeycloak` (ignore caching for this kata).
   2. Extract the authorization code information from the request URL by calling `parseAuthResponseUrl` with the request URL. Investigate the information you have here.
   3. Retrieve the code verifier using the `state`.
   4. Construct the token request:
      - `tokenUrl`: `wellKnown.token_endpoint`
      - `clientId`: Refer to Keycloak settings.
      - `clientSecret`: Refer to Keycloak settings.
      - `code`: The code from the auth response.
      - `codeVerifier`: The code verifier from the session.
      - `redirectUrl`: The redirect URL from the session.
   5. Exchange the authorization code for a token. Use the `fetcher` method from `authlib` to send the token request and parse the response into a `TokenResponse`, which contains the ID token.
   6. The ID token is an encoded JWT string. Call `parseIdToken` to extract the necessary information.
   7. Delete the `codeVerifier` from the session by calling `deleteAuthCode` with the `state`.

Log the parsed token and examine the information it contains. Now, you have everything needed to establish a session.

## Establishing a Session

You can now generate a random session ID and store the user information in a map, which will serve as our session store. This map will be used to validate user requests. The functionality is already provided by `authlib`. Check the call to `initSessionMap` in [api.ts](src/api.ts).

1. Call `createSession` with the ID token. This will generate a new session ID and store the user information in the global session map.
2. The generated session ID needs to be sent to the user. We’ll use a cookie for this. Use `mkCookie` to create a valid cookie string with the following options:
   ```ts
   {
     httpOnly: true,
     secure: false,
     sameSite: "Strict",
     path: "/",
     expires: new Date(Date.now() + 1000 * 60 * 60),
   }
   ```
3. Set the `Set-Cookie` header to our created cookie and respond with a 302 status code, redirecting to http://localhost:8080.

You've now completed the login process. To test it, open `http://localhost:8080` in your browser and click the `Login` button. You should be redirected to the Keycloak login page. If you are already logged in to Keycloak, this step will be barely noticeable. After logging in, you should be redirected back to the client and see the home page.

Open the browser’s developer tools and check the cookies (in Chrome, go to `Application > Cookies > <Domain>`). You should see a cookie named `sessionId` with the generated session ID.

Note that this session is different from the Keycloak session.

Now, we can secure the `Secret Page`.

## Protecting the Secret Page

Using the utilities provided by `initSessionMap`, you can protect the `Secret Page` so that only authenticated users with a valid session can access it.

1. Use `parseCookies` to access the `sessionId` from the request.
2. Check if the session exists in the session map.
3. If the session exists:
   - Respond with a `200` status code and return the content of the `Secret Page`.
4. If the session does not exist:
   - Respond with a `307` status code and redirect to the login page at `/api/signin`.

After successfully implementing this, you should not be able to access the `Secret Page` without first logging in. Additionally, any attempt to access the `Secret Page` without a valid session should automatically redirect you to the login page.

## Logging Out

Just as we implemented the login process, we can now implement the logout functionality by providing a `/api/signout` endpoint that redirects to the Keycloak logout page and a `/api/signout/callback` endpoint that clears the session and the session cookie.

1. In the `/api/signout` endpoint:
   1. Fetch the well-known endpoints using `wellKnownKeycloak`. We are particularly interested in the `end_session_endpoint`.
   2. Use `mkLogoutUrl` to construct the logout URL using the `end_session_endpoint`, the `redirectUrl` from the session, and the `CLIENT_ID`.
   3. Respond with a `307` status code and redirect the user to the constructed logout URL.

Now, you should be able to log out by navigating to `http://localhost:8080/api/signout` or by clicking the `Logout` button on the `Secret Page`. You should be redirected to Keycloak and see its logout confirmation page. Clicking on the logout button will redirect you back to `/api/signout/callback`.

At this point, you will be logged out of the Keycloak server.

Check your browser cookies. The `sessionId` cookie should still be present. We need to clear it in the next step; otherwise, you will still be able to access the `Secret Page`.

## Clearing the Session

To complete the kata, we need to clear the session and the session cookie. This is done in the `/api/signout/callback` endpoint.

1. Use `parseCookies` to access the `sessionId`.
2. Delete the session from the session map by calling `deleteSession` with the `sessionId`.
3. Clear the session cookie by setting a new cookie with the same name (`sessionId`), an empty value, and an expiration date in the past.
4. Respond with a `307` status code and redirect to `http://localhost:8080`. Don't forget to set the `Set-Cookie` header.

Once this is implemented, the user should be completely logged out, and the `Secret Page` should no longer be accessible without logging in again.

Congratulations! You've successfully implemented OAuth2 Authorization Code Flow with session management in a Node.js application.
