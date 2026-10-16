import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check } from 'lucide-react';

interface QRModalProps {
  roomUrl: string;
  roomCode: string;
  onClose: () => void;
}

export const QRModal: React.FC<QRModalProps> = ({ roomUrl, roomCode, onClose }) => {
  const [qrSrc, setQrSrc] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(roomUrl, {
      width: 240,
      margin: 1,
      color: {
        dark: '#171717',
        light: '#ffffff',
      },
    })
      .then((url) => setQrSrc(url))
      .catch((err) => console.error('Failed to generate QR code', err));
  }, [roomUrl]);

  const handleCopy = () => {
    navigator.clipboard.writeText(roomUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-xl relative text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 id="qr-modal-title" className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-1">
          Scan to join
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4 font-mono font-bold">
          {roomCode}
        </p>

        <div className="flex justify-center p-3 bg-white border border-neutral-200 rounded-xl mb-4">
          {qrSrc ? (
            <img src={qrSrc} alt={`QR code for ${roomCode}`} className="w-52 h-52 object-contain" />
          ) : (
            <div className="w-52 h-52 flex items-center justify-center text-xs text-neutral-400">
              Generating...
            </div>
          )}
        </div>

        <button
          onClick={handleCopy}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-medium rounded-lg transition-colors cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Link Copied' : 'Copy Room Link'}</span>
        </button>
      </div>
    </div>
  );
};
