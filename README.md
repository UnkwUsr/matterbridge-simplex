## matter-bridge-simplex

This is adapter for [matterbridge](https://github.com/42wim/matterbridge) that
adds support for [SimpleX Chat](https://github.com/simplex-chat/simplex-chat).

* files not yet supported, but currently it can send image previews from
  simplex chat to matterbridge
* matterbridge version should be higher than `1.26.0` (although at this moment
  latest release is exactly `1.26.0`, so you have to build matterbridge from
  master branch, which have fixes for api endpoint)
  * UPD: can download latest version from maintained (not by me)
    [fork](https://github.com/bibanon/matterbridge/releases) or just use docker

## Usage

### docker-compose

* Run simplex chat cli once locally, create profile, set profile picture and
  add it to some chat. Its database will be created in `~/.simplex` directory.
  Make sure it is not colliding with your possibly existing database.
  * note: for easy of use, connect bot to chat you want with the first try.
    This is because under the hood `docker-compose.yml` have hardcoded chat id.
    Or you can find it (chat id) later by following instruction in
    [manual](#manual) section and update `docker-compose.yml` correspondingly.
* Put simplex database into `data/simplex` of this repository directory

  ```
  mkdir -p data/simplex && mv ~/.simplex/* data/simplex/
  ```

* Configure `matterbridge.toml` (copy example from `matterbridge.toml.example`
  and follow matterbridge
  [documentation](https://github.com/42wim/matterbridge/wiki/How-to-create-your-config))
* Run:

  ```
  docker compose up --build`
  ```

### Manual

Clone dependency library from simplex-chat repo (it is part of it) and build js
from typescript (you need to have installed nodejs, npm and typescript):

```
git submodule update --init --recursive --depth 1
( cd lib/simplex-chat-client-typescript/ && npm install && tsc )
```

Start simplex chat websocket server (example on port 5225):

```
simplex-chat -p 5225
```

Configure matterbridge api endpoint (copy file `matterbridge.toml.example` to
`matterbridge.toml` and edit to your needs)

Run matterbridge:

```
matterbridge -conf matterbridge.toml
```

And finally run our bridge between matterbridge api and simplex chat:

Format:

```
node main.js <MATTERBRIDGE_API_ADDRESS> <MATTERBRIDGE_GATEWAY> <SIMPLEX_LISTEN_ADDRESS> <SIMPLEX_CHAT_ID> <CHAT_TYPE (contact/group)>
```

Example:

```
node main.js 127.0.0.1:4242 gateway1 127.0.0.1:5225 4 group
```

P.S. getting simplex chat id is a little bit hard. You can try guess if you
have few chats, or use next command to get list of them:

```
simplex-chat -e '/_get chats 1 pcc=off' | tail -n +2 | jq '.[].chatInfo | (.groupInfo // .contact) | [.groupId // .contactId, .localDisplayName]'
```

## Contact

Contact me via simplex chat: <https://smp12.simplex.im/a#fvW9jWlBynDpPlMfFz-wXfR2D9iRmWf--nsDArGTm5I>
