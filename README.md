## matter-bridge-simplex

This is adapter for [matterbridge](https://github.com/42wim/matterbridge) that
adds support for [SimpleX Chat](https://github.com/simplex-chat/simplex-chat).

* files not yet supported, but currently it can send images preview from
  simplex chat to matterbridge
* matterbridge version should be higher than `1.26.0` (although at this moment
  latest release is exactly `1.26.0`, so you have to build matterbridge from
  master branch, which have fixes for api endpoint)

## Preparation

Clone dependency library from simplex-chat repo (it is part of it) and build js
from typescript:

```
git submodule update --init --recursive --depth 1
( cd lib/simplex-chat-client-typescript/ && npm install && tsc )
```

## Usage

First start simplex chat (example on port 5225):

```
simplex-chat -p 5225
```

Then configure api endpoint in matterbridge:

```
[api.myapi]
BindAddress="127.0.0.1:4242"
Buffer=1000

[[gateway]]
name="gateway1"
enable=true

[[gateway.inout]]
account="api.myapi"
channel="api"

# also of course you must add the second end of the bridge. Here is example
for telegram: (for details read matterbridge docs)
#
# [telegram.mytg]
# Token="tg_bot_token"
# RemoteNickFormat="{NICK}: "
#
# [[gateway.inout]]
# account="telegram.mytg"
# channel="tg_channel_id"
```

Run matterbridge:

```
matterbridge -conf example.toml
```

And finally run our bridge between matterbridge api and simplex chat:

Format:

```
node main.js <MATTERBRIDGE_API_ADDRESS> <MATTERBRIDGE_GATEWAY> <SIMPLEX_LISTEN_ADDRESS> <SIMPLEX_CHAT_ID> <CHAT_TYPE (contact/group)>
```

Example:

```
node main.js 127.0.0.1:4242 gateway1 127.0.0.1:5225 1 group
```
