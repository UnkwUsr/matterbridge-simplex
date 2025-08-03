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
* **bonus feature:** you can mark messages so that they can be read only from
  simplex chat side. For it you need to send message in simplex chat that
  starts with `/hide`. Example: `/hide this message will be replaced on all
  other platforms with informational message about that message is hidden and
  can be read only via simplex chat`

## Usage

### docker-compose

* Prepare SimpleX Chat database
  * Easiest way is to run simplex-chat cli version, then your database will be
    at `~/.simplex` directory.
  * While you're there, before moving database you have to add this bot profile
    to some chat you want to be used for bridging. (it's id should be 4, which
    is default hardcoded in docker-compose file. You can find it by following
    [Obtaining chat id](#Obtaining_chat_id) tip. If it differs, then edit
    docker-compose.yml file).
  * Finally move database to `data/simplex` and give it permissions: `mkdir -p
    data/simplex && mv ~/.simplex/simplex_v1_* data/simplex && chmod 777 data/
    -R`
    * P.S. giving 777 permissions is not really good idea, but I don't know any
      other simple way to make it work with docker.
* Configure `matterbridge.toml` (copy example from `matterbridge.toml.example`
  and follow matterbridge
  [documentation](https://github.com/42wim/matterbridge/wiki/How-to-create-your-config))
* Run:

  ```
  docker compose up --build
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
node main.js 127.0.0.1:4242 gateway1 127.0.0.1:5225 1 group
```

## Tips

### Obtaining chat id

You can get chat id of selected chat by using cli command `/i #group_name` or
`/i @contact_name`.

You can get list of all chats with their id's with this command (requires
[jq](https://github.com/jqlang/jq) utility to be installed):

```
simplex-chat -e '/_get chats 1 pcc=off' | tail -n +2 | jq '.[].chatInfo | (.groupInfo // .contact) | [.groupId // .contactId, .localDisplayName]'
```

## Contact

Contact me via simplex chat: <https://smp12.simplex.im/a#fvW9jWlBynDpPlMfFz-wXfR2D9iRmWf--nsDArGTm5I>
