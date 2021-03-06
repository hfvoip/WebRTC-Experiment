﻿global.defaultChannel = 'WebRTC Experiments Room';
var pubnub = { channel: global.defaultChannel };

/* initializing the socket.io */
var socket;
pubnub.init = function (pub) {
    socket_config.channel = pubnub.channel;
    socket = io.connect('https://pubsub.pubnub.com/webrtc-experiment', socket_config);

    socket.on('connect', pub.connect);
    socket.on('message', pub.callback);
};

pubnub.unsubscribe = function () {
    //PUBNUB.unsubscribe({ channel: pubnub.channel });
};

/* main wrapper function used to initialize the socket.io */
function initSocket(callback) {
    pubnub.init({
        
        /* message returned by socket.io */
        callback: function (response) {
            
            /* if same user sent message; don't get! */
            if (response.userToken === global.userToken) return;

            /* both ends MUST support opus; otherwise don't use it! */
            response.isopus !== 'undefined' && (isopus = response.isopus && isopus);

            /* if a room is gone busy or someone joined the room. Hide room from all other peers! */
            if (response.isBusyRoom && response.ownerToken !== global.userToken) {
                
                /* Remove room from all other peers! Because it is now a busy room! */
                var owner = $('#' + response.ownerToken);
                if (owner) {
                    owner = owner.parentNode;
                    owner.parentNode.removeChild(owner);
                }
            }
            
            /* not yet joined or created any room!..search the room for current site visitor! */
            else if (global.isGetAvailableRoom && response.roomToken) getAvailableRooms(response);
            
            /* either offer or answer sdp sent by other end */
            else if (response.firstPart || response.secondPart) {
                
                /* because sdp size is larger than what pubnub supports for single request...that's why it is splitted into two parts */
                if (response.firstPart) {
                    global.firstPart = response.firstPart;

                    if (global.secondPart) {
                        global.sdp = JSON.parse(global.firstPart + global.secondPart);

                        if (global.offerer) global.rtc.onanswer(global.sdp);
                        else createAnswer(global.sdp);
                    }
                }
                if (response.secondPart) {
                    global.secondPart = response.secondPart;
                    if (global.firstPart) {

                        global.sdp = JSON.parse(global.firstPart + global.secondPart);

                        if (global.offerer) global.rtc.onanswer(global.sdp);
                        else createAnswer(global.sdp);
                    }
                }
            }
            
            /* if someone is joining your room! */
            else if (response.participant && response.forUser == global.userToken) {
                setTimeout(function () {
                    global.participant = response.participant;

                    if (!global.isPrivateRoom) {
                        pubnub.unsubscribe();
                        pubnub.channel = global.roomToken;

                        initSocket(createOffer);
                    }
                    else createOffer();
                }, 100);
            }
            
            /* process ice candidates sent by other end */
            else if (global.rtc && response.candidate && !global.isGotRemoteStream) {
                global.rtc.addice({
                    sdpMLineIndex: response.candidate.sdpMLineIndex,
                    candidate: JSON.parse(response.candidate.candidate)
                });

            }
            
            /* if you got the stream by other user; stop getting more ice from him! */
            else if (response.gotStream) global.stopSendingICE = true;
            
            /* other end closed the webpage! The user is being informed. */
            else if (response.end && global.isGotRemoteStream) refreshUI();
        },
        
        /* socket is connected */
        connect: function () {
            callback && callback();
        }
    });
}

/* other end tried to close the webpage.....ending the peer connection! */
window.onbeforeunload = window.onunload = function () {
    socket.send({
        end: true,
        userName: global.userName,
        userToken: global.userToken
    });
};