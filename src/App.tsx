/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { LobbyView } from './components/LobbyView';
import { RoomView } from './components/RoomView';
import { DeleteModal } from './components/DeleteModal';
import { QRModal } from './components/QRModal';
import { WipedNotice } from './components/WipedNotice';
import { AuthModal } from './components/AuthModal';
import { DashboardModal } from './components/DashboardModal';
import { ClientRoomState, UserProfile, UserCreatedRoom } from './types';
import { formatBytes, sanitizeRoomCode, generateRoomCode } from './utils/fileHelpers';
import { getOrCreateDeviceId } from './utils/device';

export default function App() {
  const [currentRoom, setCurrentRoom] = useState<ClientRoomState | null>(null);
  const [peerId] = useState<string>(() => 'peer_' + Math.random().toString(36).slice(2, 9));
  const [peerName, setPeerName] = useState<string>('Guest');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [activeGuestRoom, setActiveGuestRoom] = useState<UserCreatedRoom | null>(null);
  const deviceId = useRef<string>(getOrCreateDeviceId());

  // Dark mode state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('openshare_theme') || localStorage.getItem('beamdrop_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('openshare_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('openshare_theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  // User Auth State
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('openshare_token') || localStorage.getItem('beamdrop_token'));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // User Rooms State
  const [userRooms, setUserRooms] = useState<UserCreatedRoom[]>([]);

  // Dashboard State
  const [showDashboardModal, setShowDashboardModal] = useState<boolean>(false);

  // Modals state
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [showQRModal, setShowQRModal] = useState<boolean>(false);

  // Wiped notice state
  const [wipedInfo, setWipedInfo] = useState<{ roomCode: string; reason: string } | null>(null);

  // WebSocket reference
  const wsRef = useRef<WebSocket | null>(null);

  // Check auth session
  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Session expired');
        return res.json();
      })
      .then((data) => {
        setUser(data.user);
        setPeerName(data.user.username);
      })
      .catch(() => {
        localStorage.removeItem('openshare_token');
        localStorage.removeItem('beamdrop_token');
        setToken(null);
        setUser(null);
      });
  }, [token]);

  // Fetch user active rooms
  const fetchUserRooms = useCallback(async () => {
    if (!token) {
      setUserRooms([]);
      return;
    }
    try {
      const res = await fetch('/api/user/rooms', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUserRooms(data.rooms || []);
      }
    } catch (e) {
      console.error('Failed to fetch user rooms', e);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchUserRooms();
    } else {
      setUserRooms([]);
    }
  }, [token, fetchUserRooms]);

  // Load active room for this device if not logged in
  const fetchGuestRooms = useCallback(async () => {
    if (user) {
      setActiveGuestRoom(null);
      return;
    }
    try {
      const res = await fetch('/api/device/rooms', {
        headers: { 'x-device-id': deviceId.current },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.rooms && data.rooms.length > 0) {
          setActiveGuestRoom(data.rooms[0]);
        } else {
          setActiveGuestRoom(null);
        }
      }
    } catch (e) {
      console.error('Failed to load guest rooms', e);
    }
  }, [user]);

  useEffect(() => {
    fetchGuestRooms();
  }, [fetchGuestRooms]);

  // Setup WebSocket connection to room
  const connectWebSocket = useCallback(
    (roomId: string, name: string) => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      try {
        const socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          socket.send(
            JSON.stringify({
              type: 'join',
              roomId,
              peerId,
              peerName: name,
              userId: user?.id,
              deviceId: deviceId.current,
            })
          );

          if (token) {
            socket.send(JSON.stringify({ type: 'auth', token }));
          }
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'room:init') {
              setCurrentRoom(data.room);
              setErrorMessage(null);
              setWipedInfo(null);
            } else if (data.type === 'peer:update') {
              setCurrentRoom((prev) => (prev ? { ...prev, activePeers: data.activePeers } : null));
            } else if (data.type === 'files:updated') {
              setCurrentRoom((prev) =>
                prev
                  ? {
                      ...prev,
                      files: data.files,
                      totalBytes: data.totalBytes,
                    }
                  : null
              );
            } else if (data.type === 'room:log') {
              setCurrentRoom((prev) => {
                if (!prev) return null;
                const exists = prev.logs.some((l) => l.id === data.log.id);
                if (exists) return prev;
                const updatedLogs = [...prev.logs, data.log];
                if (updatedLogs.length > 50) updatedLogs.shift();
                return { ...prev, logs: updatedLogs };
              });
            } else if (data.type === 'room:deleted') {
              setWipedInfo({
                roomCode: data.roomId || roomId,
                reason: data.reason || 'Room closed and files deleted.',
              });
              setCurrentRoom(null);
              setShowDeleteModal(false);
            } else if (data.type === 'error') {
              setErrorMessage(data.message);
            }
          } catch (e) {
            console.error('Failed to parse WebSocket event', e);
          }
        };

        socket.onclose = () => {
          // Socket disconnected
        };

        socket.onerror = (err) => {
          console.warn('WebSocket encountered error:', err);
        };
      } catch (err) {
        console.error('Failed to create WebSocket connection:', err);
      }
    },
    [peerId, token, user?.id]
  );

  // Auth Action Handlers
  const handleLogin = async (emailInput: string, passwordInput: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput, password: passwordInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to sign in');

      localStorage.setItem('openshare_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setPeerName(data.user.username);
      setShowAuthModal(false);
    } catch (err: any) {
      setAuthError(err.message || 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (emailInput: string, usernameInput: string, passwordInput: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput, username: usernameInput, password: passwordInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create account');

      localStorage.setItem('openshare_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setPeerName(data.user.username);
      setShowAuthModal(false);
    } catch (err: any) {
      setAuthError(err.message || 'Registration failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setCurrentRoom(null);
    setWipedInfo(null);
    setErrorMessage(null);

    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.pathname);

    localStorage.removeItem('openshare_token');
    localStorage.removeItem('beamdrop_token');
    setToken(null);
    setUser(null);
    setPeerName('Guest');

    setShowDashboardModal(false);
    setShowAuthModal(false);
    setShowDeleteModal(false);
    setShowQRModal(false);

    setTimeout(() => {
      fetchGuestRooms();
    }, 100);
  };

  const isOwner = Boolean(
    currentRoom?.isOwner ||
    (user && currentRoom?.ownerId && user.id === currentRoom.ownerId) ||
    (currentRoom?.ownerDeviceId && currentRoom.ownerDeviceId === deviceId.current)
  );

  const handleLeaveRoom = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setCurrentRoom(null);
    setWipedInfo(null);
    setErrorMessage(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.pathname);
    fetchGuestRooms();
    fetchUserRooms();
  };

  // Create Room action
  const handleCreateRoom = async (code: string, durationMinutes: number, passcode?: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-device-id': deviceId.current,
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          customCode: code,
          durationMinutes,
          passcode,
          peerId,
          deviceId: deviceId.current,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create room');
      }

      const assignedRoomId = data.roomId;
      const url = new URL(window.location.href);
      url.searchParams.set('room', assignedRoomId);
      window.history.pushState({}, '', url.toString());

      const currentName = user?.username || 'Sender';
      setPeerName(currentName);
      connectWebSocket(assignedRoomId, currentName);
      fetchGuestRooms();
      fetchUserRooms();
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while creating the room');
    } finally {
      setIsLoading(false);
    }
  };

  // Join Room action
  const handleJoinRoom = async (code: string, passcode?: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams();
      if (passcode) params.set('passcode', passcode);

      const headers: Record<string, string> = { 'x-device-id': deviceId.current };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/rooms/${encodeURIComponent(code)}?${params.toString()}`, { headers });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Unable to join room.');
      }

      const url = new URL(window.location.href);
      url.searchParams.set('room', code);
      window.history.pushState({}, '', url.toString());

      const guestName = user?.username || 'Receiver';
      setPeerName(guestName);
      connectWebSocket(code, guestName);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not connect to room');
    } finally {
      setIsLoading(false);
    }
  };

  // Upload files to current room
  const handleUploadFiles = async (files: File[]) => {
    if (!currentRoom) return;
    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('uploader', user?.username || peerName);
    formData.append('deviceId', deviceId.current);
    for (const f of files) {
      formData.append('files', f);
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/rooms/${encodeURIComponent(currentRoom.id)}/upload`);
        xhr.setRequestHeader('x-device-id', deviceId.current);

        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(pct);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              if (data.files && Array.isArray(data.files)) {
                setCurrentRoom((prev) => (prev ? { ...prev, files: data.files, totalBytes: data.totalBytes || prev.totalBytes } : null));
              }
            } catch (e) {}
            resolve();
          } else {
            try {
              const err = JSON.parse(xhr.responseText);
              reject(new Error(err.error || 'Upload failed'));
            } catch {
              reject(new Error('Upload failed'));
            }
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(formData);
      });
    } catch (err: any) {
      setErrorMessage(`Upload error: ${err.message}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Download individual file
  const handleDownloadFile = (roomId: string, fileId: string, fileName: string) => {
    const downloadUrl = `/api/rooms/${encodeURIComponent(roomId)}/files/${encodeURIComponent(fileId)}/download`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download all as ZIP
  const handleDownloadAllZip = () => {
    if (!currentRoom) return;
    const zipUrl = `/api/rooms/${encodeURIComponent(currentRoom.id)}/download-all`;
    const link = document.createElement('a');
    link.href = zipUrl;
    link.download = `${currentRoom.id}-files.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Delete individual file
  const handleDeleteFile = async (roomId: string, fileId: string) => {
    try {
      const headers: Record<string, string> = {
        'x-device-id': deviceId.current,
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/files/${encodeURIComponent(fileId)}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete file');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error deleting file');
    }
  };

  // Permanently delete room and wipe server storage
  const handleConfirmDeleteRoom = async (targetRoomId?: string) => {
    const roomIdToWipe = targetRoomId || currentRoom?.id;
    if (!roomIdToWipe) return;

    setIsDeleting(true);
    try {
      const headers: Record<string, string> = {
        'x-device-id': deviceId.current,
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/rooms/${encodeURIComponent(roomIdToWipe)}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete room');
      }

      setWipedInfo({
        roomCode: roomIdToWipe,
        reason: 'The room was closed.',
      });
      setCurrentRoom(null);
      setShowDeleteModal(false);

      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      window.history.pushState({}, '', url.toString());
      fetchGuestRooms();
      fetchUserRooms();
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not delete room');
    } finally {
      setIsDeleting(false);
    }
  };

  // Return to Lobby / New Room
  const handleHomeClick = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setCurrentRoom(null);
    setWipedInfo(null);
    setErrorMessage(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.pushState({}, '', url.toString());
  };

  // Auto-connect if URL has ?room=... or handle ?autostart=1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get('room');
    const autostart = params.get('autostart');

    if (roomFromUrl) {
      handleJoinRoom(sanitizeRoomCode(roomFromUrl));
    } else if (autostart === '1') {
      const autoCode = generateRoomCode();
      handleCreateRoom(autoCode, 60);
    }
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col font-sans transition-colors">
      {/* Header */}
      <Header
        currentRoomId={currentRoom?.id || null}
        activePeers={currentRoom?.activePeers || 1}
        user={user}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        onHomeClick={handleHomeClick}
        onOpenAuth={() => setShowAuthModal(true)}
        onOpenDashboard={() => setShowDashboardModal(true)}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {wipedInfo ? (
          <WipedNotice
            roomCode={wipedInfo.roomCode}
            reason={wipedInfo.reason}
            onCreateNew={handleHomeClick}
          />
        ) : currentRoom ? (
          <RoomView
            room={currentRoom}
            isOwner={isOwner}
            currentPeerName={user?.username || peerName}
            onUploadFiles={handleUploadFiles}
            onDownloadFile={(fileId, fileName) => handleDownloadFile(currentRoom.id, fileId, fileName)}
            onDownloadAllZip={handleDownloadAllZip}
            onDeleteFile={(fileId) => handleDeleteFile(currentRoom.id, fileId)}
            onRequestDeleteRoom={() => setShowDeleteModal(true)}
            onLeaveRoom={handleLeaveRoom}
            onOpenQR={() => setShowQRModal(true)}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
          />
        ) : (
          <LobbyView
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            isLoading={isLoading}
            errorMessage={errorMessage}
            activeGuestRoom={activeGuestRoom}
            userRooms={userRooms}
            onOpenGuestRoom={(code) => handleJoinRoom(code)}
            onDeleteGuestRoom={async (code) => {
              await handleConfirmDeleteRoom(code);
              fetchGuestRooms();
            }}
            onDeleteUserRoom={async (code) => {
              await handleConfirmDeleteRoom(code);
              fetchUserRooms();
            }}
            isLoggedIn={!!user}
            onOpenAuth={() => setShowAuthModal(true)}
          />
        )}
      </main>

      {/* Modals */}
      {showDeleteModal && currentRoom && (
        <DeleteModal
          roomCode={currentRoom.id}
          fileCount={currentRoom.files.length}
          totalSizeFormatted={formatBytes(currentRoom.totalBytes)}
          isDeleting={isDeleting}
          onConfirm={() => handleConfirmDeleteRoom(currentRoom.id)}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}

      {showQRModal && currentRoom && (
        <QRModal
          roomCode={currentRoom.id}
          roomUrl={`${window.location.origin}/?room=${encodeURIComponent(currentRoom.id)}`}
          onClose={() => setShowQRModal(false)}
        />
      )}

      {/* Authentication Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLogin={handleLogin}
        onRegister={handleRegister}
        isLoading={authLoading}
        errorMessage={authError}
      />

      {/* Dashboard Modal */}
      {showDashboardModal && user && token && (
        <DashboardModal
          isOpen={showDashboardModal}
          onClose={() => setShowDashboardModal(false)}
          user={user}
          token={token}
          onSelectRoom={(roomId) => {
            handleJoinRoom(roomId);
            setShowDashboardModal(false);
          }}
          onDeleteRoom={handleConfirmDeleteRoom}
          onDeleteFile={handleDeleteFile}
          onDownloadFile={handleDownloadFile}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800 py-6 px-4 text-center text-xs text-neutral-400 dark:text-neutral-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} openShare. Simple, temporary file sharing.</p>
          <p>Files are permanently removed from the server when rooms are deleted.</p>
        </div>
      </footer>
    </div>
  );
}
