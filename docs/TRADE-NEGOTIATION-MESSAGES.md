# Private Trade Negotiation Messages

This foundation adds a private message thread between the owner of an RFQ and the supplier store that submitted a current offer.

## API

- `GET /api/trade/messages?threadId=<id>`: authenticated buyer or supplier participant only; returns up to 200 messages in chronological order.
- `POST /api/trade/messages`: same-origin authenticated write with rate limiting.
  - Buyer starts a thread by sending `requestId`, `offerId`, and `message`.
  - Either participant continues an existing thread with `threadId` and `message`.
  - Message body is plain text, trimmed, and limited to 2,000 characters.

## Privacy and scope

- Thread reads and writes are restricted to the RFQ buyer or the user who owns the supplier store.
- A thread can only be initiated from an open RFQ and a currently submitted offer.
- Country-scoped negotiation is blocked unless the corresponding country market pack is live.
- The API does not return email addresses, phone numbers, or participant account identifiers.
- Sender labels are relative (`you` / `other`); the client should not infer legal identity from them.
- Messages are negotiation communications only. They do not accept an offer, create an order, reserve inventory, establish a contract, or initiate payment.
- Closing, retention, reporting, attachments, translation, and abuse moderation are separate follow-up capabilities and are not implemented here.

## Deployment

Migration `0013_trade_negotiation_messages.sql` is included in this draft only. It has not been applied to any D1 database. The PR is stacked on the unmerged trade foundation and must not be merged independently of its base chain.
