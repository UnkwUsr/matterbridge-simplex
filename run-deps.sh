tmux split-window -h 'simplex-chat -p 5225'
tmux split-window -h 'sudo ~/Downloads/ssh-chat/ssh-chat --verbose --bind 127.0.0.1:48320 --identity /home/meda/.ssh/id_rsa'

echo 'waiting 5 sec, you starting ssh-chat' && sleep 5
tmux split-window -h 'ssh 127.0.0.1 -p 48320'
matterbridge -conf matter-simplex.toml

tmux select-layout even-horizontal

# node main.js
