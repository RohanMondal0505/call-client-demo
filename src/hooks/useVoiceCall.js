import { useEffect, useRef, useState } from "react";

// Custom ICE configuration mapping to coturn + google
const ICE_SERVERS = [
	{ urls: "stun:stun.l.google.com:19302" },
	{ urls: "stun:124.123.18.19:3478" },
	{ urls: "turn:124.123.18.19:3478", username: "ijpcall", credential: "pods365@localserver" },
];

export function useVoiceCall(userId, onLog) {
	const wsRef = useRef(null);
	const pcRef = useRef(null);
	const streamRef = useRef(null);

	const [callState, setCallState] = useState("idle");
	const [currentCallId, setCurrentCallId] = useState(null);
	const [remoteUser, setRemoteUser] = useState(null);
	const [isMuted, setIsMuted] = useState(false);
	const [connected, setConnected] = useState(false);

	useEffect(() => {
		if (!userId) return;

		// Use backend URL from env or fallback to localhost
		const WS_BASE_URL = "wss://ijp.rohans.uno";
		const ws = new WebSocket(`${WS_BASE_URL}/ws/call?userId=${userId}`);
		wsRef.current = ws;

		ws.onopen = () => {
			setConnected(true);
			onLog("🔌 WebSocket Connected");
		};

		ws.onmessage = (event) => {
			const msg = JSON.parse(event.data);
			onLog("⬇️ RCV: " + msg.type);
			handleServerEvent(msg);
		};

		ws.onclose = () => {
			setConnected(false);
			onLog("❌ WebSocket Disconnected");
			setTimeout(() => {
				// simple reconnect
				if (userId) {
					onLog("🔄 Reconnecting...");
				}
			}, 3000);
		};

		return () => {
			ws.close();
			cleanup();
		};
	}, [userId]);

	function handleServerEvent(msg) {
		switch (msg.type) {
			case "incoming_call":
				setCallState("incoming");
				setCurrentCallId(msg.callId);
				setRemoteUser(msg.caller);
				break;
			case "call_ringing":
				setCallState("ringing");
				setCurrentCallId(msg.callId);
				setRemoteUser(msg.target);
				break;
			case "call_accepted":
				setCallState("connecting");
				createOffer(msg.callId);
				break;
			case "webrtc_offer":
				setCallState("connecting");
				handleOffer(msg.callId, msg.sdp);
				break;
			case "webrtc_answer":
				handleAnswer(msg.sdp);
				break;
			case "ice_candidate":
				handleIceCandidate(msg.candidate);
				break;
			case "call_ended":
			case "call_rejected":
			case "call_timeout":
			case "call_cancelled":
			case "call_busy":
			case "call_failed":
				onLog(`🛑 Call End Reason: ${msg.type}`);
				cleanup();
				setCallState("idle");
				break;
		}
	}

	async function createPeerConnection() {
		const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
		pcRef.current = pc;

		pc.oniceconnectionstatechange = () => {
			onLog(`❄️ ICE State: ${pc.iceConnectionState}`);
		};

		// Get microphone
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			streamRef.current = stream;
			stream.getTracks().forEach((track) => pc.addTrack(track, stream));
			onLog("🎤 Microphone attached");
		} catch (err) {
			onLog("❌ Microphone error: " + err.message);
		}

		// Handle remote audio
		pc.ontrack = (event) => {
			onLog("🔊 Remote audio track received");
			let audioEl = document.getElementById(`audio-${userId}`);
			if (!audioEl) {
				audioEl = document.createElement("audio");
				audioEl.id = `audio-${userId}`;
				audioEl.autoplay = true;
				document.body.appendChild(audioEl);
			}
			audioEl.srcObject = event.streams[0];
		};

		// Send ICE candidates to server
		pc.onicecandidate = (event) => {
			if (event.candidate) {
				wsRef.current?.send(
					JSON.stringify({
						action: "ice_candidate",
						callId: currentCallId,
						candidate: event.candidate,
					}),
				);
			}
		};

		pc.onconnectionstatechange = () => {
			onLog(`🔗 WebRTC State: ${pc.connectionState}`);
			if (pc.connectionState === "connected") {
				setCallState("connected");
			}
		};

		return pc;
	}

	async function createOffer(callId) {
		const pc = await createPeerConnection();
		const offer = await pc.createOffer();
		await pc.setLocalDescription(offer);
		onLog("📤 Sending SDP Offer");
		wsRef.current?.send(
			JSON.stringify({
				action: "webrtc_offer",
				callId,
				sdp: pc.localDescription,
			}),
		);
	}

	async function handleOffer(callId, sdp) {
		const pc = await createPeerConnection();
		await pc.setRemoteDescription(new RTCSessionDescription(sdp));
		const answer = await pc.createAnswer();
		await pc.setLocalDescription(answer);
		onLog("📤 Sending SDP Answer");
		wsRef.current?.send(
			JSON.stringify({
				action: "webrtc_answer",
				callId,
				sdp: pc.localDescription,
			}),
		);
	}

	async function handleAnswer(sdp) {
		onLog("📥 Applying SDP Answer");
		await pcRef.current?.setRemoteDescription(new RTCSessionDescription(sdp));
	}

	async function handleIceCandidate(candidate) {
		if (pcRef.current && pcRef.current.remoteDescription) {
			await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
		} else {
			onLog("⚠️ Ignored ICE candidate before remote description");
		}
	}

	function cleanup() {
		pcRef.current?.close();
		pcRef.current = null;
		streamRef.current?.getTracks().forEach((t) => t.stop());
		streamRef.current = null;
		setCurrentCallId(null);
		setRemoteUser(null);
		setIsMuted(false);

		const audioEl = document.getElementById(`audio-${userId}`);
		if (audioEl) audioEl.remove();
	}

	const sendAction = (action, payload = {}) => {
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			onLog(`⬆️ SND: ${action}`);
			wsRef.current.send(JSON.stringify({ action, ...payload }));
		}
	};

	const startCall = (targetUserId) => sendAction("call_initiate", { targetUserId, callType: "audio" });
	const acceptCall = () => sendAction("call_accept", { callId: currentCallId });
	const rejectCall = () => sendAction("call_reject", { callId: currentCallId });
	const endCall = () => sendAction("call_end", { callId: currentCallId });
	const cancelCall = () => sendAction("call_cancel", { callId: currentCallId });

	return {
		callState,
		connected,
		remoteUser,
		currentCallId,
		startCall,
		acceptCall,
		rejectCall,
		endCall,
		cancelCall,
	};
}
