# Adept GIC Lead Tracker

Standalone Node.js edition with email-and-password sign-in, SQLite, and role-based access. The repository starts with an empty tracker.

## Run locally

Use Node.js 24 or later. From the repository root, build the app and set the initial administrator’s email.

```bash
npm run build
export TRACKER_ADMIN_EMAIL=admin@example.com
export TRACKER_ORIGIN=http://localhost:3000
```

On Bash, create the admin login using a password of at least 15 characters. The prompt hides the password and the command reads it from stdin.

```bash
read -rsp 'New tracker password: ' tracker_password
printf '\n'
printf '%s\n' "$tracker_password" | npm run account -- "$TRACKER_ADMIN_EMAIL"
unset tracker_password
npm start
```

Open http://localhost:3000 and sign in. Changing a password with the account command also revokes that account’s sessions.

## Add employees

1. In User Administration, save the employee’s email and tracker role.
2. On the host, repeat the hidden-password command with the employee’s email in place of "$TRACKER_ADMIN_EMAIL". Run it against the same database as the server.
3. Send the invitation from User Administration and share the initial password through a separate approved channel. The hosting operator handles password resets with the account command.

Removing a tracker role blocks access to tracker records. The app enforces Sales, Ops, Management and Admin permissions on the server.

## Deploy from GitHub

Push this directory to a GitHub repository, then use a Node.js host with a persistent disk. Run `npm run build` before `npm start`. Set these values in the host environment.

| Setting | Value |
| --- | --- |
| TRACKER_ADMIN_EMAIL | Initial administrator’s email |
| TRACKER_ORIGIN | Exact HTTPS URL users visit, with no path |
| TRACKER_DB | Absolute path to the SQLite database on the persistent disk |
| TRACKER_HOST | Bind address, defaults to 127.0.0.1 |
| PORT | Port, defaults to 3000 |

Use one running app instance with this SQLite database and terminate HTTPS at the host or reverse proxy. Some managed hosts require TRACKER_HOST=0.0.0.0 so the proxy can reach the process. Keep the SQLite database and its companion files on the persistent disk. GitHub holds the source code, and the Node.js host runs the app.

To move tracker records, use Export backup in the earlier tracker and Merge browser backup as Admin in this edition. Create employee credentials and roles for the new deployment.
