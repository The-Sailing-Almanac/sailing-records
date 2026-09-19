# `@stax/activity-core`

A lightweight, dependency-free core library containing pure functions to build ActivityPub and WebFinger payload structures.

## API

### Types
* `ActivityPubEntity`: Represents an internal entity to be exposed as an actor.
* `ActivityPubActor`: Represents an ActivityPub Actor object (type `Person`).
* `WebFingerResponse`: Represents WebFinger payload structure.
* `ActivityPubNote`: Represents a standard `Create` wrap for a timeline `Note`.

### Functions
* `buildActor(entity, domain)`: Builds the followable actor payload.
* `buildWebFinger(username, domain)`: Returns the WebFinger response mapping accounts to actor endpoints.
* `buildCreateNote(actorId, object, domain)`: Builds the JSON-LD `Create` activity payload for delivery to inboxes.
