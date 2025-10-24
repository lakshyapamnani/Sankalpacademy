# Notification Processor (Firebase Functions)

This small Cloud Function processes entries written to the Realtime Database path `/notificationQueue/{itemId}` and sends push notifications via FCM to either a teacher or all students in a batch.

What it does
- Listens for new items under `/notificationQueue`.
- Reads notification tokens from:
  - `notificationTokens/teachers/{teacherId}` for teacher notifications
  - `notificationTokens/studentsByBatch/{batchId}` for batch-students notifications
- Sends FCM multicast messages (handles batching up to 500 tokens per request).
- Removes the queue item when processed.

Setup & deploy

1. Install Firebase CLI and login:

```bash
# install (if not already)
npm install -g firebase-tools
firebase login
```

2. Initialize functions (if not already) and install dependencies:

```bash
cd functions
npm install
```

3. Configure your Firebase project (one-time):

```bash
firebase use --add
```

4. Deploy functions:

```bash
npm run deploy
```

Notes
- This function uses the Firebase Admin SDK and requires appropriate permissions.
- The frontend code already writes tokens under `notificationTokens/teachers` and `notificationTokens/studentsByBatch` when users register for push (via `registerForPushNotifications`).
- Ensure you have your FCM server credentials properly configured in your Firebase project (Admin SDK handles this when you deploy functions in your project).

Security
- Do NOT commit service account keys into the repository. Use the Firebase project deployed functions which provide the required credentials.
