# GitHub OAuth Setup

The Blog Poster component can connect to your GitHub account to list organizations and pull requests. To enable this:

## 1. Create a GitHub OAuth App

1. Go to [GitHub Developer Settings → OAuth Apps](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in:
   - **Application name**: e.g. `XCH` or your app name
   - **Homepage URL**: `http://localhost:3000` (or your production URL)
   - **Authorization callback URL**: `http://localhost:3000/api/github/callback` (or `https://yourdomain.com/api/github/callback` in production)
4. Click **Register application**
5. Copy the **Client ID** and generate a **Client Secret**

## 2. Add to .env

Add to your `next_xcom/.env`:

```
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
```

For production, you can optionally set:

```
GITHUB_CALLBACK_URL=https://yourdomain.com/api/github/callback
```

(Defaults to `http://localhost:3000/api/github/callback` if not set.)

## 3. Use in Blog Poster

1. Open the **Blog Poster** page
2. Click **Connect GitHub**
3. Authorize the app on GitHub
4. Select an **Organization** from the first dropdown
5. Select a **Pull request** from the second dropdown (shows PR number, title, and repo)

PRs are filtered to those **you created** in the selected organization.
