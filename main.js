const { ChatClient } = require("./lib/simplex-chat-client-typescript");
const { ChatType } = require(
    "./lib/simplex-chat-client-typescript/dist/command",
);
const { ciContentText, ChatInfoType } = require(
    "./lib/simplex-chat-client-typescript/dist/response",
);

listen_simplex();

async function init_simplex() {
    const chat = await ChatClient.create("ws://localhost:5225");
    // this example assumes that you have initialized user profile for chat bot via terminal CLI
    const user = await chat.apiGetActiveUser();
    if (!user) {
        console.log("no user profile");
        return;
    }
    console.log(
        `Bot profile: ${user.profile.displayName} (${user.profile.fullName})`,
    );
    // creates or uses the existing long-term address for the bot
    const address = (await chat.apiGetUserAddress()) ||
        (await chat.apiCreateUserAddress());
    console.log(`Bot address: ${address}`);
    // enables automatic acceptance of contact connections
    await chat.enableAddressAutoAccept();

    return chat;
}

async function listen_simplex() {
    const chat = await init_simplex();

    await processMessages(chat);

    async function processMessages(chat) {
        for await (const r of chat.msgQ) {
            const resp = r instanceof Promise ? await r : r;
            switch (resp.type) {
                case "contactConnected": {
                    // sends welcome message when the new contact is connected
                    const { contact } = resp;
                    console.log(`${contact.profile.displayName} connected`);
                    await chat.apiSendTextMessage(
                        ChatType.Direct,
                        contact.contactId,
                        "Hello! I am a simple squaring bot - if you send me a number, I will calculate its square",
                    );
                    continue;
                }
                case "newChatItem": {
                    // const { chatInfo } = resp.chatItem;
                    // if (chatInfo.type !== ChatInfoType.Direct) continue;

                    const username = resp.user.localDisplayName;
                    const msg = ciContentText(resp.chatItem.chatItem.content);
                    if (msg) {
                        matterbridge_send(msg, username);
                    }
                }
            }
        }
    }
}

// function simplex_send(text) {
//     chat.apiSendTextMessage(
//         ChatType.Direct,
//         chatInfo.contact.contactId,
//         text,
//     );
// }

function matterbridge_send(text, username) {
    const url = "http://127.0.0.1:4242/api/message";
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
