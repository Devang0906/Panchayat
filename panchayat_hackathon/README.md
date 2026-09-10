# Panchayat — Community Connect

Hackathon-ready Firebase community platform.

## Features

- Email/password authentication
- Resident accounts
- Problem reporting
- Anonymous problem posting
- Society Head dashboard
- Problem status management
- Community Help Board
- Help request and completion flow
- Reward points for community help
- Community leaderboard
- Emergency alert system
- Emergency response points
- Polls and voting
- Events and announcements
- Responsive clean UI

## Reward System

- Offer a useful skill: +5 points
- Complete a neighbour help request: +25 points
- Respond to an emergency: +50 points

## Firebase Setup

1. Create a Firebase project.
2. Enable Email/Password Authentication.
3. Create a Firestore database.
4. Put your Firebase web configuration in `firebase.js`.
5. Publish `firestore.rules`.
6. Create the Society Head account:
   - Email: `head@panchayat.com`
   - Use a strong password.
7. Run using Live Server or another local HTTP server.

## Run

```bash
python -m http.server 5500
```

Open:

`http://localhost:5500`

Do not open `index.html` directly with `file://`.

## Important

The reward balance is stored in Firestore and displayed on the leaderboard.

For a production deployment, move point awarding to trusted server-side Cloud Functions or another backend so users cannot manipulate their own rewards.

Emergency alerts in this demo are community notifications, not a replacement for official emergency services.
