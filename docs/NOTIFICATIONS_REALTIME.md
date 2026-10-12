# Opskl Notifications & Real-Time Experience (Phase 7)

## 1. Executive Summary

Phase 7 establishes a multi-channel, event-driven notification and real-time engine across the Opskl platform:
- **In-App Notification Center**: Dedicated Inbox and Preferences screens in both Worker and Organizer mobile applications.
- **Expo Push Notifications**: Lockscreen banners and sound alerts using `expo-notifications` with contextual permission priming.
- **Supabase Realtime**: Live Postgres changes (`postgres_changes`) streamed directly to mobile apps for instant notification delivery and live crew roster arrivals with automatic channel cleanup.
- **External Messaging**: Indian TRAI DLT-approved SMS templates (Header: `OPSKIL`) and WhatsApp Business Cloud API templates with strict user opt-in consent safeguards.

---

## 2. Event Matrix & Idempotency Safeguards

Every notification utilizes a deterministic idempotency key format:
$$\text{idempotencyKey} = \texttt{notif\_} + \langle\text{type}\rangle + \texttt{\_} + \langle\text{entityId}\rangle + [\texttt{\_}\langle\text{qualifier}\rangle]$$

| Event Type | Target User | Priority | Trigger Condition | Idempotency Key Format | Action URL |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `job_opportunity` | Worker | Normal | New shift published matching worker locality | `notif_job_opportunity_<jobId>_<workerId>` | `/shift/[id]` |
| `application_submitted` | Worker | Normal | Worker applies via right swipe | `notif_application_submitted_<appId>` | `/shift/[id]` |
| `application_shortlisted` | Worker | High | Organizer shortlists candidate | `notif_application_shortlisted_<appId>` | `/shift/[id]` |
| `worker_selected` | Worker | Urgent | Organizer selects worker (30m countdown) | `notif_worker_selected_<bookingId>` | `/shift/[id]` |
| `booking_confirmed` | Worker | High | Worker confirms shift selection | `notif_booking_confirmed_<bookingId>` | `/(tabs)/my-shifts` |
| `shift_reminder` | Worker | Urgent | T-2 hours before shift reporting time | `notif_shift_reminder_<bookingId>_t_minus_2h` | `/(tabs)/my-shifts` |
| `standby_callout` | Worker | Urgent | Cancellation occurs; standby slot opens | `notif_standby_callout_<jobId>_<timestamp>` | `/shift/[id]` |
| `check_in` | Organizer | Normal | Worker enters venue code `OP-XXXX` | `notif_check_in_<bookingId>` | `/shift/[id]` |
| `check_out` | Organizer | Normal | Worker departure time recorded | `notif_check_out_<bookingId>` | `/shift/[id]` |
| `payout_settled` | Worker | High | Direct UPI transfer settles with bank UTR | `notif_payout_settled_<paymentId>` | `/(tabs)/earnings` |
| `payout_failed` | Worker | Urgent | Bank timeout or invalid UPI handle | `notif_payout_failed_<paymentId>` | `/(tabs)/earnings` |
| `dispute_update` | Both | High | Platform mediation notes posted | `notif_dispute_update_<disputeId>_<status>` | `/(tabs)/my-shifts` |

Duplicate submissions are intercepted at the database level by the stored procedure [`send_notification_safe`](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/migrations/20261012000005_notifications_and_realtime.sql#L78-L175) and return `{ "success": true, "duplicate": true }` with zero duplicate database writes.

---

## 3. Push Notifications & Contextual Priming

Native configuration uses `expo-notifications` and `expo-device`:
- **Contextual Priming**: Rather than prompting users immediately on app startup, the app displays a clear explanation card highlighting the value:
  > *"Never miss high-demand shifts in Mumbai, immediate worker selection calls, and instant UPI bank payout credits."*
- **Android Notification Channels**: Creates high-importance channel `opskil_shifts` with custom vibration pattern and brand blue light.
- **Token Rotation & Revocation**: Push tokens are registered in `user_push_tokens` upon grant and deactivated upon user logout via [`revokePushTokenSafe`](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/packages/shared/src/supabase/notifications.ts#L182-L190).

---

## 4. Real-Time Engine (Supabase Realtime)

Implemented in [packages/shared/src/notifications/realtime.ts](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/packages/shared/src/notifications/realtime.ts):
- `subscribeToUserNotifications`: Listens to `notifications` table `INSERT` events filtered by `user_id=eq.${userId}`. Prepends new notifications in-app with unread badge updates in real time.
- `subscribeToShiftRoster`: Listens to `bookings` table changes for a specific `job_id`, streaming arrival check-ins directly into the organizer crew console.
- **Cleanup Guarantee**: Both methods return an unsubscribe function that invokes `supabase.removeChannel(channel)` in `useEffect` cleanup return blocks to prevent memory leaks.

---

## 5. External Messaging & Consent

Implemented in [packages/shared/src/notifications/external-messaging.ts](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/packages/shared/src/notifications/external-messaging.ts):
- **User Consent**: WhatsApp and SMS notifications are strictly governed by `user_notification_preferences`. If `whatsapp_enabled` or `sms_enabled` is false, messages are suppressed.
- **WhatsApp Cloud API Templates**:
  - `opskil_shift_confirmed_v1`
  - `opskil_payout_settled_v1`
- **TRAI DLT-Compliant SMS Templates**:
  - Header: `OPSKIL`
  - Reminder Template ID: `1707168902148192001`
  - Payout Credit Template ID: `1707168902148192002`
