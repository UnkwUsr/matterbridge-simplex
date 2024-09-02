// TODO: currently idk how to get this number. This I get from newChatItem
const simplex_contactId = 4;

const MATTERBRIDGE_ADDRESS = "127.0.0.1:4242";
const SIMPLEX_ADDRESS = "127.0.0.1:5225";

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
    // creates or uses the existing long-term address for the bot
    const address = (await chat.apiGetUserAddress()) ||
        (await chat.apiCreateUserAddress());
    console.log(`[simplex] Bot address: ${address}`);
    await chat.disableAddressAutoAccept();

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
                case "newChatItem": {
                    const { chatInfo } = resp.chatItem;
                    if (chatInfo.type == ChatInfoType.ContactRequest) continue;
                    // skipping, to not duplicate messages: one with text only
                    // and second with text and file
                    if (resp.chatItem.chatItem.file) continue;

                    const username = extract_username(resp);
                    const msg = ciContentText(resp.chatItem.chatItem.content);
                    if (msg) {
                        console.log("Resending text");
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

                    const username = extract_username(resp);
                    console.log("Resending file");
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
    console.log("[simplex] Message resent successfully!");

    await globalThis.simplex_chat.apiSendTextMessage(
        ChatType.Direct,
        simplex_contactId,
        text,
    );
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
                console.log("[matterbridge] Message resent successfully!");
            } else {
                console.error(
                    "[matterbridge] Error sending message:",
                    response.status,
                );
            }
        })
        .catch((error) => {
            console.error("[matterbridge] Error:", error);
        });
}

function prepare_data(text, username, file) {
    const data = {
        text: text,
        username: username,
        gateway: "gateway1",
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

function extract_username(resp) {
    const { chatInfo } = resp.chatItem;

    if (chatInfo.type == ChatInfoType.Direct) {
        return chatInfo.contact.localDisplayName;
    }
    if (chatInfo.type == ChatInfoType.Group) {
        return resp.chatItem.chatItem.chatDir.groupMember
            .localDisplayName;
    }
}
