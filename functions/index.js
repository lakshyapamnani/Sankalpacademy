const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// Helper to flatten token objects into an array of tokens
const collectTokens = (snapshotVal) => {
  if (!snapshotVal) return [];

  // snapshotVal can be { tokenKey: { token, updatedAt } } or nested by student id
  const tokens = [];

  // If the immediate value contains token objects
  if (typeof snapshotVal === 'object') {
    Object.values(snapshotVal).forEach((val) => {
      if (!val) return;
      if (typeof val === 'object' && 'token' in val) {
        tokens.push(val.token);
        return;
      }

      // If nested (e.g., studentsByBatch -> studentId -> tokenKey -> {token})
      if (typeof val === 'object') {
        Object.values(val).forEach((inner) => {
          if (inner && typeof inner === 'object' && 'token' in inner) {
            tokens.push(inner.token);
          }
        });
      }
    });
  }

  return tokens;
};

// Splits an array into chunks of a given size
const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

exports.processNotificationQueue = functions.database
  .ref('/notificationQueue/{itemId}')
  .onCreate(async (snapshot, context) => {
    const item = snapshot.val();
    if (!item || !item.notification) {
      console.warn('Invalid queue item, removing', context.params.itemId);
      await snapshot.ref.remove();
      return null;
    }

    const { role, referenceId, notification } = item;
    const db = admin.database();

    try {
      let tokens = [];

      if (role === 'teacher') {
        const tokenSnap = await db.ref(`notificationTokens/teachers/${referenceId}`).once('value');
        tokens = collectTokens(tokenSnap.val());
      } else if (role === 'students_batch') {
        // tokens stored under notificationTokens/studentsByBatch/{batchId}/{studentId}/{tokenKey}
        const tokenSnap = await db.ref(`notificationTokens/studentsByBatch/${referenceId}`).once('value');
        tokens = collectTokens(tokenSnap.val());
      } else {
        console.warn('Unknown role in queue item:', role);
      }

      if (!tokens.length) {
        console.log('No tokens found for', role, referenceId);
        await snapshot.ref.remove();
        return null;
      }

      // FCM send limits: sendMulticast supports up to 500 tokens; batch if necessary
      const batches = chunkArray(tokens, 500);
      const payload = {
        notification: {
          title: notification.title || 'New class scheduled',
          body: notification.message || '',
        },
        data: {
          classId: notification.classId || '',
          batchId: notification.batchId || '',
          teacherId: notification.teacherId || '',
        },
      };

      for (const batch of batches) {
        const response = await admin.messaging().sendMulticast({ tokens: batch, ...payload });
        console.log(`Sent ${response.successCount} messages, ${response.failureCount} failures`);

        if (response.failureCount > 0) {
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              console.warn('Failed token:', batch[idx], resp.error && resp.error.message);
            }
          });
        }
      }

      // Remove queue item once processed
      await snapshot.ref.remove();
      return null;
    } catch (error) {
      console.error('Error processing notification queue item', context.params.itemId, error);
      // Keep the item in queue so it can be retried or inspected
      return null;
    }
  });
