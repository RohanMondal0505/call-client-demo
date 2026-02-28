import { Activity, Phone, PhoneIncoming, PhoneOff, User, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useVoiceCall } from "./hooks/useVoiceCall";

export default function App() {
	const [userId, setUserId] = useState("");
	const [isJoined, setIsJoined] = useState(false);

	const [targetId, setTargetId] = useState("");
	const [logs, setLogs] = useState([]);
	const logsEndRef = useRef(null);

	const addLog = useCallback((msg) => {
		setLogs((prev) => [...prev.slice(-49), `${new Date().toLocaleTimeString()} - ${msg}`]);
	}, []);

	// Auto-scroll logs
	useEffect(() => {
		logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [logs]);

	// Hook handles connection and WebRTC logic
	const { callState, connected, remoteUser, currentCallId, startCall, acceptCall, rejectCall, endCall, cancelCall } =
		useVoiceCall(isJoined ? userId : null, addLog);

	const handleJoin = (e) => {
		e.preventDefault();
		if (userId.trim()) setIsJoined(true);
	};

	const handleCall = (e) => {
		e.preventDefault();
		if (targetId.trim()) startCall(targetId.trim());
	};

	return (
		<>
			<div className="bg-blob blob-1"></div>
			<div className="bg-blob blob-2"></div>

			<div className="glass-panel">
				<header className="app-header">
					<div className="app-title">
						<Activity className="text-primary" size={24} color="#6366f1" />
						Pods365 Call
					</div>
					<div className={`status-badge ${connected ? "connected" : "disconnected"}`}>
						{connected ? <Wifi size={14} /> : <WifiOff size={14} />}
						{connected ? "Connected" : "Offline"}
					</div>
				</header>

				{!isJoined ? (
					// Login State
					<form className="input-group" onSubmit={handleJoin} style={{ marginTop: "20px" }}>
						<label className="input-label">Connect as User / Vendor ID</label>
						<div style={{ position: "relative" }}>
							<User size={18} color="#94a3b8" style={{ position: "absolute", top: 14, left: 14 }} />
							<input
								value={userId}
								onChange={(e) => setUserId(e.target.value)}
								placeholder="e.g. 64b8a..."
								style={{ paddingLeft: 40 }}
								autoFocus
							/>
						</div>
						<button type="submit" className="btn btn-primary" disabled={!userId.trim()}>
							Initialize Connection
						</button>
					</form>
				) : (
					// Active App Logic
					<div className="call-state-container">
						{callState === "idle" && (
							<>
								<div className="avatar-ring">
									<User size={40} color="#6366f1" />
								</div>
								<h2 className="call-title">Ready to Call</h2>
								<p className="call-subtitle">Your ID: {userId}</p>

								<form className="input-group" onSubmit={handleCall} style={{ width: "100%", marginTop: "16px" }}>
									<input
										value={targetId}
										onChange={(e) => setTargetId(e.target.value)}
										placeholder="Enter recipient ID to call..."
										required
									/>
									<button type="submit" className="btn btn-success" disabled={!targetId.trim() || !connected}>
										<Phone size={18} /> Start Audio Call
									</button>
								</form>
							</>
						)}

						{callState === "ringing" && (
							<>
								<div className="avatar-ring ringing">
									<Phone size={40} color="#f8fafc" />
								</div>
								<h2 className="call-title">Calling</h2>
								<p className="call-subtitle">{remoteUser?.fullName || targetId}</p>

								<div className="action-row">
									<button className="btn btn-danger btn-circle" onClick={cancelCall} title="Cancel Call">
										<PhoneOff size={24} />
									</button>
								</div>
							</>
						)}

						{callState === "incoming" && (
							<>
								<div className="avatar-ring ringing" style={{ borderColor: "#10b981" }}>
									<PhoneIncoming size={40} color="#10b981" />
								</div>
								<h2 className="call-title">Incoming Call</h2>
								<p className="call-subtitle">{remoteUser?.fullName || "Unknown Caller"}</p>

								<div className="action-row">
									<button className="btn btn-danger btn-circle" onClick={rejectCall} title="Decline">
										<PhoneOff size={24} />
									</button>
									<button className="btn btn-success btn-circle" onClick={acceptCall} title="Accept">
										<Phone size={24} />
									</button>
								</div>
							</>
						)}

						{(callState === "connecting" || callState === "connected") && (
							<>
								<div className="avatar-ring" style={{ border: "2px solid #10b981" }}>
									<Activity size={40} color="#10b981" className="pulse-icon" />
								</div>
								<h2 className="call-title">In Call</h2>
								<p className="call-subtitle">with {remoteUser?.fullName || targetId}</p>

								<div className="action-row">
									<button className="btn btn-danger btn-circle" onClick={endCall} title="End Call">
										<PhoneOff size={24} />
									</button>
								</div>
							</>
						)}
					</div>
				)}

				{/* Real-time Event Log */}
				{isJoined && (
					<div className="log-panel" style={{ marginTop: "auto" }}>
						{logs.map((log, i) => (
							<div
								key={i}
								style={{
									color:
										log.includes("❌") || log.includes("🛑")
											? "#ef4444"
											: log.includes("⬆️")
												? "#60a5fa"
												: log.includes("🔌") || log.includes("✅")
													? "#10b981"
													: "#f8fafc",
								}}>
								{log}
							</div>
						))}
						<div ref={logsEndRef} />
					</div>
				)}
			</div>
		</>
	);
}
