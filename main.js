// fix for node < 18 (like on Ubuntu)
try {
    global.fetch = require("node-fetch");
} catch {}

const { ChatClient } = require("./lib/simplex-chat-client-typescript");
const { ChatType } = require(
    "./lib/simplex-chat-client-typescript/dist/command",
);
const { ciContentText, ChatInfoType } = require(
    "./lib/simplex-chat-client-typescript/dist/response",
);

if (process.argv.length < 7) {
    console.error(
        "Usage: <MATTERBRIDGE_API_ADDRESS> <MATTERBRIDGE_GATEWAY> <SIMPLEX_LISTEN_ADDRESS> <SIMPLEX_CHAT_ID> <CHAT_TYPE (contact/group)>",
    );
    process.exit(1);
}

const MATTERBRIDGE_ADDRESS = process.argv[2];
const MATTERBRIDGE_GATEWAY = process.argv[3];
const SIMPLEX_ADDRESS = process.argv[4];
// this one is hard to get manually. I got from newChatItem:
// * chatItem.chatInfo.contact.contactId
// * chatItem.chatInfo.groupInfo.groupId
const simplex_chat_id = process.argv[5];
const chat_type = process.argv[6];

globalThis.simplex_chat = -1;
Promise.all([listen_simplex(), listen_matterbridge()]);

async function init_simplex() {
    const chat = await ChatClient.create("ws://" + SIMPLEX_ADDRESS);
    // this example assumes that you have initialized user profile for chat bot via terminal CLI
    const user = await chat.apiGetActiveUser();
    if (!user) {
        console.log("[simplex] no user profile");
        return;
    }
    console.log(
        `[simplex] Bot profile: ${user.profile.displayName} (${user.profile.fullName})`,
    );

    await check_chat_id(chat, simplex_chat_id, chat_type);

    // creates or uses the existing long-term address for the bot
    const address = (await chat.apiGetUserAddress()) ||
        (await chat.apiCreateUserAddress());
    console.log(`[simplex] Bot address: ${address}`);
    // await chat.disableAddressAutoAccept();

    return chat;
}

async function listen_simplex() {
    globalThis.simplex_chat = await init_simplex();

    await processMessages(globalThis.simplex_chat);

    async function processMessages(chat) {
        for await (const r of chat.msgQ) {
            const resp = r instanceof Promise ? await r : r;
            switch (resp.type) {
                // case "contactConnected": {
                //     // sends welcome message when the new contact is connected
                //     const { contact } = resp;
                //     console.log(`[simplex] ${contact.profile.displayName} connected`);
                //     continue;
                // }
                case "newChatItems": {
                    const { chatInfo } = resp.chatItems[0];
                    if (chatInfo.type == ChatInfoType.ContactRequest) continue;
                    // skipping, to not duplicate messages: one with text only
                    // and second with text and file
                    if (resp.chatItems[0].chatItem.file) continue;

                    const username = extract_username(resp.chatItems[0]);
                    const msg = ciContentText(
                        resp.chatItems[0].chatItem.content,
                    );
                    if (msg) {
                        console.log("[matter->sxc] Resending text");
                        matterbridge_send(msg, username);
                    }
                    break;
                }
                case "rcvFileDescrReady": {
                    const { type, image, text } =
                        resp.chatItem.chatItem.content.msgContent;
                    if (type != "image") continue;

                    // example of image: data:image/jpg;base64,/9j/4AAQSkZ...
                    // P.S. this takes only preview. Probably for bridge it is
                    // enough, but for original file we need to use
                    // apiReceiveFile(fileId)
                    const content = image.split("base64,")[1];
                    const filename = resp.chatItem.chatItem.file.fileName;
                    const file = [content, filename];

                    const username = extract_username(resp.chatItem);
                    console.log("[matter->sxc] Resending file");
                    matterbridge_send(text, username, file);
                    break;
                }
                default:
                    // console.log(resp);
                    break;
            }
        }
    }
}

async function listen_matterbridge() {
    while (true) {
        try {
            const response = await fetch(
                "http://" + MATTERBRIDGE_ADDRESS + "/api/messages",
            );
            if (!response.ok) {
                throw new Error("[matterbridge] HTTP error ${response.status}");
            }
            const data = await response.json();

            for (ev of data) {
                await simplex_send(ev.text, ev.username);
            }

            await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
            console.error(
                "[matterbridge] Error listening for messages:",
                error,
            );
        }
    }
}

async function simplex_send(text, username) {
    text = username + ": " + text;
    await globalThis.simplex_chat.apiSendTextMessage(
        chat_type == "contact" ? ChatType.Direct : ChatType.Group,
        simplex_chat_id,
        text,
    );
    console.log("[matter->sxc] Message resent successfully!");
}

function matterbridge_send(text, username, file = undefined) {
    const url = "http://" + MATTERBRIDGE_ADDRESS + "/api/message";
    const data = prepare_data(text, username, file);

    fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    })
        .then((response) => {
            if (response.ok) {
                console.log("[sxc->matter] Message resent successfully!");
            } else {
                console.error(
                    "[sxc->matter] Error sending message:",
                    response.status,
                );
            }
        })
        .catch((error) => {
            console.error("[sxc->matter] Error:", error);
        });
}

function prepare_data(text, username, file) {
    const data = {
        text: text,
        username: username,
        gateway: MATTERBRIDGE_GATEWAY,
    };
    if (file) {
        // hack to make matterbridge show sender name on empty text
        if (text == "") {
            text = " ";
        }

        const [content, filename] = file;
        data.Extra = {
            file: [
                {
                    Data: content,
                    Name: filename,
                    Comment: text,
                },
            ],
        };
    }

    if (text.startsWith("/hide")) {
        data.text =
            "*This message was hidden by sender. You can read it only from SimpleX Chat.*";
        delete data.Extra;
    }
    return data;
}

function extract_username(chatItem) {
    const { chatInfo } = chatItem;

    if (chatInfo.type == ChatInfoType.Direct) {
        return chatInfo.contact.localDisplayName;
    }
    if (chatInfo.type == ChatInfoType.Group) {
        return chatItem.chatItem.chatDir.groupMember
            .localDisplayName;
    }
}

async function check_chat_id(chat, chat_id, chat_type) {
    const chat_id_prefix = chat_type == "contact" ? "@" : "#";

    let r = await chat.sendChatCmdStr(
        `/_info ${chat_id_prefix}${chat_id}`,
    );
    if (r["type"] == "chatCmdError") {
        r = r["chatError"];
        if (r["type"] == "errorStore") {
            r = r["storeError"];
            if (
                r["type"] == "groupNotFound" || r["type"] == "contactNotFound"
            ) {
                console.log(
                    `[simplex] Provided ${chat_type} id does not exists, probably contact/group mismatch. Please see tips section on how to obtain chat id.`,
                );
                process.exit(1);
            }
        }
        console.log("Unknown error in check_chat_id:", r);
        process.exit(1);
    }

    let info = null;
    if (chat_type == "contact") {
        info = r["contact"]["localDisplayName"];
    } else {
        info = r["groupInfo"]["localDisplayName"];
    }
    const name = info["localDisplayName"];
    console.log(`[simplex] Bridging to ${chat_type} chat with name "${name}"`);
}
