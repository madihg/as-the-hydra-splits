# as the hydra

a participatory branching, for one room.

a host screen displays a living tree and a qr code. anyone in the room scans the qr with their phone and joins the cast. each phone receives one line of a poem and a delivery direction, in turn. when a participant has read aloud, they tap split. the line lands on the host screen, the tree grows a new branch, and the next phone unlocks. extras who scan after the cast is full get a watch-along view.

at the close, the host screen reads: here the hydra splits.

## surfaces

- `index.html` lobby and qr-link router
- `host.html` projector view: lines on the left, tree on the right, qr top-right
- `participant.html` phone view: waiting → your turn → spoken
- `watch.html` for late scanners and silent companions
- `admin.html` password-gated session controls

## stack

static html / css / vanilla js. supabase realtime for state and sync. vercel for hosting and serverless admin endpoints. no build step, no framework.

design system lives under `design-system/`. tokens are extracted into `shared/design.css`.

## environment

server-only env vars (set in vercel project settings):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `ADMIN_PASSWORD_HASH` - sha256 hex of the admin password
- `ADMIN_JWT_SECRET` - random 32+ byte hex

publishable supabase config sits in `shared/config.js` and is safe to commit.

generate the password hash:

```
node -e "console.log(require('crypto').createHash('sha256').update('YOUR_PASSWORD').digest('hex'))"
```

generate the jwt secret:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## run locally

the static surfaces (host, participant, watch, index) work over `python -m http.server` or any static server. the admin api routes need `vercel dev` to run since they are serverless functions.

```
npm install
npx vercel dev
```

then open http://localhost:3000.

## perform

1. open `host.html` on the room screen.
2. open `admin.html` on a private device, log in, click start new session.
3. invite the room to scan the qr.
4. let the room read.
5. when the cast is complete, end the session and the host screen settles into the closing line.

---

halim madi, 2026
