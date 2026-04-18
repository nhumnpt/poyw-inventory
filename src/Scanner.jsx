import React, { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Zap, ZapOff } from 'lucide-react';

export default function Scanner({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const isStarted = useRef(false);
  const [torchOn, setTorchOn] = React.useState(false);

  useEffect(() => {
    if (isStarted.current) return;
    isStarted.current = true;

    scannerRef.current = new Html5Qrcode("reader");

    const startScanner = async () => {
      try {
        await scannerRef.current.start(
          { facingMode: "environment" },
          {
            fps: 20, // Increased FPS for faster capture
            qrbox: (viewfinderWidth, viewfinderHeight) => {
                // Return a dynamic rectangular box that covers a good portion of the screen
                const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                const width = viewfinderWidth * 0.8;
                const height = minEdge * 0.4;
                return { width, height };
            },
            aspectRatio: 1.0
          },
          (decodedText) => {
            if (scannerRef.current) {
                scannerRef.current.stop().then(() => {
                    onScan(decodedText);
                }).catch(console.error);
            }
          },
          () => { /* Ignore failures */ }
        );
      } catch (err) {
        console.error("Scanner error:", err);
        alert("ไม่สามารถเข้าถึงกล้องได้ กรุณาตรวจสอบการอนุญาตใช้งานกล้อง");
        onClose();
      }
    };

    startScanner();

    return () => {
        if (scannerRef.current?.isScanning) {
            scannerRef.current.stop().catch(console.error);
        }
    };
  }, [onScan, onClose]);

  const toggleTorch = async () => {
    try {
        if (scannerRef.current && scannerRef.current.isScanning) {
            const state = !torchOn;
            await scannerRef.current.applyVideoConstraints({
                advanced: [{ torch: state }]
            });
            setTorchOn(state);
        }
    } catch (e) {
        console.warn("Torch not supported on this device");
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-[99999] flex flex-col items-center justify-center font-sans">
      {/* Overlay UI */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-between p-8">
        <div className="text-center mt-12 animate-in fade-in slide-in-from-top duration-700">
           <h2 className="text-white text-2xl font-black tracking-tight mb-2">SCAN BARCODE</h2>
           <p className="text-blue-400 text-sm font-bold uppercase tracking-widest">หันกล้องไปที่รหัสพัสดุ</p>
        </div>

        {/* Laser Line Animation */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[120px] pointer-events-none border-2 border-white/20 rounded-xl overflow-hidden">
            <div className="w-full h-0.5 bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)] absolute top-0 animate-[scan_2s_infinite_ease-in-out]"></div>
        </div>

        <div className="mb-12 flex gap-4 pointer-events-auto">
            <button 
                onClick={toggleTorch}
                className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20 hover:bg-white/20 transition-all active:scale-90"
            >
                {torchOn ? <ZapOff size={24} className="text-yellow-400" /> : <Zap size={24} />}
            </button>
            <button 
                onClick={onClose} 
                className="w-16 h-16 bg-red-500/20 backdrop-blur-md rounded-full flex items-center justify-center text-red-500 border border-red-500/40 hover:bg-red-500/30 transition-all active:scale-90"
            >
                <X size={24} />
            </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan {
          0%, 100% { top: 10%; opacity: 0.5; }
          50% { top: 90%; opacity: 1; }
        }
        #reader {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
        }
        #reader video {
            object-fit: cover !important;
            width: 100% !important;
            height: 100% !important;
        }
      `}} />

      {/* The Camera View */}
      <div className="w-full h-full relative">
        <div id="reader" className="w-full h-full bg-black"></div>
      </div>
    </div>
  );
}
