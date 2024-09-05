// fix for node < 18 (like on Ubuntu)
try {
    global.fetch = require("node-fetch");
} catch {}

const { ChatClient } = require("./lib/simplex-chat-client-typescript");
const { ChatType } = require(
    "./lib/simplex-chat-client-typescript/dist/command",
);
const { ciContentText } = require(
    "./lib/simplex-chat-client-typescript/dist/response",
);

// TODO: currently idk how to get this number. This I get from newChatItem
const simplex_contactId = 3;

globalThis.simplex_chat = -1;
Promise.all([listen_simplex(), listen_matterbridge()]);

async function init_simplex() {
    const chat = await ChatClient.create("ws://localhost:5225");
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
                    // if (chatInfo.type !== ChatInfoType.Direct) continue;

                    const username = chatInfo.contact.localDisplayName;
                    const msg = ciContentText(resp.chatItem.chatItem.content);
                    if (msg) {
                        matterbridge_send(msg, username);
                    }
                }
            }
        }
    }
}

async function listen_matterbridge() {
    while (true) {
        try {
            const response = await fetch("http://127.0.0.1:4242/api/messages");
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

function matterbridge_send(text, username) {
    const url = "http://127.0.0.1:4242/api/message";
    [text, username] = filter_censor_message(text, username);
    const data = {
        text: text,
        username: username,
        gateway: "gateway1",
    };

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

function filter_censor_message(text, sender) {
    if (text.startsWith("/hide")) {
        return [
            "*This message was censored by sender. You can read it only from SimpleX Chat.*",
            "*censored*",
        ];
    } else {
        return [text, sender];
    }
}
