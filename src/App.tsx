/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  MapPin, 
  Clock, 
  Users, 
  Send, 
  Plus, 
  Trash2, 
  Heart,
  ChevronDown,
  ExternalLink,
  ShieldCheck,
  BookOpen,
  Download,
  Pencil,
  Save,
  X
} from 'lucide-react';

interface Attendee {
  id: string;
  name: string;
  address: string;
  count: number;
  created_at?: string;
  row_num?: number;
}

interface ConfirmedAttendee extends Attendee {
  uiKey: string;
}

const EVENT_DATE = new Date(2026, 2, 29, 9, 0, 0);
const WHATSAPP_NUMBER = '6285330351335';
const APPS_SCRIPT_URL = (import.meta.env.VITE_APPS_SCRIPT_URL || '').trim();

if (!APPS_SCRIPT_URL) {
  throw new Error('VITE_APPS_SCRIPT_URL wajib diisi di .env karena mode aplikasi menggunakan Apps Script penuh.');
}

async function parseJsonSafely(response: Response) {
  const raw = await response.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

function generateClientId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeParticipantCounts(input: Partial<Attendee>) {
  const count = Math.max(1, Number(input.count ?? 1));
  return {
    count,
  };
}

function createEmptyAttendee(): Attendee {
  return {
    id: generateClientId(),
    name: '',
    address: '',
    ...normalizeParticipantCounts({ count: 1 })
  };
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function getCountdownValue(targetDate: Date) {
  const targetMs = targetDate.getTime();
  if (Number.isNaN(targetMs)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  const diff = Math.max(0, targetMs - Date.now());
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / 1000 / 60) % 60),
    seconds: Math.floor((diff / 1000) % 60)
  };
}

export default function App() {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [needsMusicStart, setNeedsMusicStart] = useState(false);
  const [attendees, setAttendees] = useState<Attendee[]>([createEmptyAttendee()]);
  const [confirmedAttendees, setConfirmedAttendees] = useState<ConfirmedAttendee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingAttendeeKey, setEditingAttendeeKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    name: string;
    address: string;
    count: number;
    created_at?: string;
  }>({
    name: '',
    address: '',
    count: 1
  });
  const [countDrafts, setCountDrafts] = useState<Record<string, string>>({});
  const [editCountDraft, setEditCountDraft] = useState('1');
  const [actionAttendeeKey, setActionAttendeeKey] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(getCountdownValue(EVENT_DATE));

  useEffect(() => {
    fetchAttendees();
    const timer = setInterval(() => {
      setTimeLeft(getCountdownValue(EVENT_DATE));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const tryPlay = async () => {
      try {
        await audio.play();
        setNeedsMusicStart(false);
      } catch {
        setNeedsMusicStart(true);
      }
    };

    audio.loop = true;
    audio.volume = 0.35;
    tryPlay();

    const interactionEvents: Array<keyof WindowEventMap> = ['click', 'touchstart', 'keydown'];
    const startOnInteraction = () => tryPlay();
    const resumeOnFocus = () => {
      if (document.visibilityState === 'visible') tryPlay();
    };
    const keepPlaying = () => {
      if (document.visibilityState === 'visible') tryPlay();
    };

    interactionEvents.forEach((eventName) => {
      window.addEventListener(eventName, startOnInteraction, { passive: true });
    });
    window.addEventListener('focus', resumeOnFocus);
    document.addEventListener('visibilitychange', resumeOnFocus);
    audio.addEventListener('pause', keepPlaying);

    return () => {
      interactionEvents.forEach((eventName) => {
        window.removeEventListener(eventName, startOnInteraction);
      });
      window.removeEventListener('focus', resumeOnFocus);
      document.removeEventListener('visibilitychange', resumeOnFocus);
      audio.removeEventListener('pause', keepPlaying);
    };
  }, []);

  const buildUiKey = (attendee: Partial<Attendee>, index: number) =>
    `${String(attendee.id || 'no-id')}::${String(attendee.row_num || 'no-row')}::${String(attendee.created_at || 'no-date')}::${index}`;

  const fetchAttendees = async () => {
    setIsLoading(true);
    try {
      const cacheBuster = `_=${Date.now()}`;
      const url = `${APPS_SCRIPT_URL}?action=list&${cacheBuster}`;
      const response = await fetchWithTimeout(url, {
        cache: 'no-store',
      });

      const data = await parseJsonSafely(response);
      if (!response.ok || data?.success === false) {
        throw new Error(data?.detail || data?.error || 'Gagal memuat daftar tamu.');
      }

      const rows = Array.isArray(data) ? data : data?.data;
      const normalizedRows: ConfirmedAttendee[] = Array.isArray(rows)
        ? rows.map((row: Partial<Attendee>, index: number) => {
            const normalizedCounts = normalizeParticipantCounts(row || {});
            return {
              id: String(row?.id || ''),
              name: String(row?.name || ''),
              address: String(row?.address || ''),
              ...normalizedCounts,
              created_at: row?.created_at ? String(row.created_at) : undefined,
              row_num: Number(row?.row_num || 0) || undefined,
              uiKey: buildUiKey(row || {}, index),
            };
          })
        : [];
      setConfirmedAttendees(normalizedRows);
      setLoadError(null);
    } catch (error) {
      console.error("Error fetching confirmed attendees:", error);
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Gagal memuat daftar tamu. Periksa koneksi internet lalu coba lagi.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const addAttendee = () => {
    setAttendees([
      ...attendees,
      createEmptyAttendee()
    ]);
  };

  const removeAttendee = (id: string) => {
    if (attendees.length > 1) {
      setAttendees(attendees.filter(a => a.id !== id));
    }
  };

  const updateAttendeeField = (id: string, field: 'name' | 'address', value: string) => {
    setAttendees(attendees.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const updateAttendeeTotal = (id: string, count: number) => {
    setAttendees(attendees.map((a) => {
      if (a.id !== id) return a;
      const normalized = normalizeParticipantCounts({
        count,
      });
      return { ...a, ...normalized };
    }));
  };

  const sanitizeCountInput = (value: string) => value.replace(/[^\d]/g, '');

  const commitCountDraft = (id: string) => {
    const raw = countDrafts[id];
    if (raw === undefined) return;
    const normalized = normalizeParticipantCounts({ count: Number(raw || 1) });
    updateAttendeeTotal(id, normalized.count);
    setCountDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const getEffectiveCount = (attendee: Attendee) => {
    const raw = countDrafts[attendee.id];
    if (raw === undefined) return attendee.count;
    return normalizeParticipantCounts({ count: Number(raw || 1) }).count;
  };

  const handleSendWhatsApp = async () => {
    // Save to storage first
    try {
      const validAttendees = attendees.filter(a => a.name.trim());
      if (validAttendees.length > 0) {
        const attendeesToSave = validAttendees.map((attendee) => ({
          ...attendee,
          id: attendee.id || generateClientId(),
          ...normalizeParticipantCounts({ count: getEffectiveCount(attendee) }),
        }));
        const response = await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: new URLSearchParams({
            action: 'create',
            attendees: JSON.stringify(attendeesToSave)
          })
        });

        const data = await parseJsonSafely(response);
        if (!response.ok || data?.success === false) {
          throw new Error(data?.detail || data?.error || 'Gagal menyimpan daftar tamu.');
        }
        await fetchAttendees();
        setAttendees([createEmptyAttendee()]);
      }
    } catch (error) {
      console.error("Error saving attendees:", error);
      alert(error instanceof Error ? error.message : 'Gagal menyimpan daftar tamu.');
    }

    let message = `Assalamu’alaikum Warahmatullahi Wabarakatuh.\n\n`;
    message += `Saya ingin mengonfirmasi kehadiran untuk acara:\n`;
    message += `*SILATURAHMI DZURRIYAH SUNAN DRAJAD SE-MADURA*\n`;
    message += `(Reuni Keluarga Besar Drajad Madura)\n\n`;
    message += `*DAFTAR HADIR*\n\n`;

    attendees.forEach((a, index) => {
      if (a.name.trim()) {
        const normalized = normalizeParticipantCounts({ count: getEffectiveCount(a) });
        message += `${index + 1}. Nama : ${a.name}\n`;
        message += `   Alamat : ${a.address}\n`;
        message += `   Jumlah hadir : ${normalized.count}\n\n`;
      }
    });

    message += `Terima kasih.\nWassalamu’alaikum Warahmatullahi Wabarakatuh.`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`, '_blank');
  };

  const handleDownloadGuestList = () => {
    if (confirmedAttendees.length === 0) {
      alert('Belum ada data tamu untuk diunduh.');
      return;
    }

    const sanitizeText = (value: string) =>
      value
        .replace(/[^\x20-\x7E]/g, ' ')
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');

    const wrapLine = (text: string, max = 95) => {
      if (text.length <= max) return [text];
      const words = text.split(' ');
      const lines: string[] = [];
      let current = '';
      for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length > max) {
          if (current) lines.push(current);
          current = word;
        } else {
          current = next;
        }
      }
      if (current) lines.push(current);
      return lines;
    };

    const totalOrang = confirmedAttendees.reduce((acc, curr) => acc + curr.count, 0);
    const exportDate = new Date().toLocaleString('id-ID');
    const lines: string[] = [
      'Daftar Tamu Silaturahmi Dzurriyah Sunan Drajad',
      `Tanggal unduh: ${exportDate}`,
      `Jumlah pendaftar: ${confirmedAttendees.length} Tamu`,
      `Total hadir: ${totalOrang} Orang`,
      '------------------------------------------------------------'
    ];

    confirmedAttendees.forEach((attendee, index) => {
      const tanggal = attendee.created_at ? new Date(attendee.created_at).toLocaleString('id-ID') : '-';
      const base = `${index + 1}. ${attendee.name || '-'} | ${attendee.count} orang | ${tanggal}`;
      lines.push(...wrapLine(base));
      lines.push(...wrapLine(`   Alamat: ${attendee.address || '-'}`));
      lines.push('');
    });

    const linesPerPage = 48;
    const pages: string[][] = [];
    for (let i = 0; i < lines.length; i += linesPerPage) {
      pages.push(lines.slice(i, i + linesPerPage));
    }

    const objects: Record<number, string> = {};
    const pageCount = pages.length || 1;
    const firstPageObj = 3;
    const fontObjNum = firstPageObj + pageCount * 2;
    const maxObj = fontObjNum;

    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] = `<< /Type /Pages /Count ${pageCount} /Kids [${Array.from({ length: pageCount }, (_, i) => `${firstPageObj + i * 2} 0 R`).join(' ')}] >>`;

    pages.forEach((pageLines, i) => {
      const pageObjNum = firstPageObj + i * 2;
      const contentObjNum = pageObjNum + 1;

      const contentLines = [
        'BT',
        '/F1 10 Tf',
        '40 800 Td',
        ...pageLines.flatMap((line, lineIndex) => {
          const escaped = sanitizeText(line);
          if (lineIndex === 0) return [`(${escaped}) Tj`];
          return ['0 -15 Td', `(${escaped}) Tj`];
        }),
        'ET'
      ];
      const stream = contentLines.join('\n');

      objects[pageObjNum] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObjNum} 0 R >> >> /Contents ${contentObjNum} 0 R >>`;
      objects[contentObjNum] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    });

    objects[fontObjNum] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = new Array(maxObj + 1).fill(0);
    for (let i = 1; i <= maxObj; i++) {
      offsets[i] = pdf.length;
      pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
    }

    const xrefStart = pdf.length;
    pdf += `xref\n0 ${maxObj + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (let i = 1; i <= maxObj; i++) {
      pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${maxObj + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

    const blob = new Blob([pdf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `guestlist-drajad-${dateStamp}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const startEditConfirmedAttendee = (attendee: ConfirmedAttendee) => {
    const normalized = normalizeParticipantCounts(attendee);
    setEditingAttendeeKey(attendee.uiKey);
    setEditCountDraft(String(normalized.count));
    setEditDraft({
      name: attendee.name,
      address: attendee.address,
      count: normalized.count,
      created_at: attendee.created_at
    });
  };

  const cancelEditConfirmedAttendee = () => {
    setEditingAttendeeKey(null);
    setEditCountDraft('1');
    setEditDraft({ name: '', address: '', count: 1 });
  };

  const saveEditConfirmedAttendee = async (attendee: ConfirmedAttendee) => {
    if (!editDraft.name.trim()) {
      alert('Nama tamu wajib diisi.');
      return;
    }
    if (!attendee.id) {
      alert('ID tamu tidak valid. Muat ulang halaman lalu coba lagi.');
      return;
    }

    setActionAttendeeKey(attendee.uiKey);
    try {
      const normalized = normalizeParticipantCounts({ count: Number(editCountDraft || editDraft.count || 1) });
      setEditCountDraft(String(normalized.count));
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({
          action: 'update',
          id: attendee.id,
          row_num: String(attendee.row_num || ''),
          name: editDraft.name.trim(),
          address: editDraft.address.trim(),
          count: String(normalized.count),
          created_at: editDraft.created_at || ''
        })
      });

      const data = await parseJsonSafely(response);
      if (!response.ok || data?.success === false) {
        throw new Error(data?.detail || data?.error || 'Gagal mengedit data tamu.');
      }

      setEditingAttendeeKey(null);
      await fetchAttendees();
    } catch (error) {
      console.error('Error updating attendee:', error);
      alert(error instanceof Error ? error.message : 'Gagal mengedit data tamu.');
    } finally {
      setActionAttendeeKey(null);
    }
  };

  const deleteConfirmedAttendee = async (attendee: ConfirmedAttendee) => {
    const isConfirmed = window.confirm('Hapus data tamu ini dari daftar?');
    if (!isConfirmed) return;
    if (!attendee.id) {
      alert('ID tamu tidak valid. Muat ulang halaman lalu coba lagi.');
      return;
    }

    setActionAttendeeKey(attendee.uiKey);
    try {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({
          action: 'delete',
          id: attendee.id,
          row_num: String(attendee.row_num || '')
        })
      });

      const data = await parseJsonSafely(response);
      if (!response.ok || data?.success === false) {
        throw new Error(data?.detail || data?.error || 'Gagal menghapus data tamu.');
      }

      if (editingAttendeeKey === attendee.uiKey) {
        cancelEditConfirmedAttendee();
      }
      await fetchAttendees();
    } catch (error) {
      console.error('Error deleting attendee:', error);
      alert(error instanceof Error ? error.message : 'Gagal menghapus data tamu.');
    } finally {
      setActionAttendeeKey(null);
    }
  };

  return (
    <div className="min-h-screen pb-20 overflow-x-hidden selection:bg-accent selection:text-white">
      <audio ref={audioRef} src="/audio/aiduun-saeed.mp3" loop preload="auto" playsInline />
      {needsMusicStart && (
        <button
          onClick={() => {
            const audio = audioRef.current;
            if (!audio) return;
            audio.play().then(() => setNeedsMusicStart(false)).catch(() => setNeedsMusicStart(true));
          }}
          className="fixed bottom-5 right-5 z-50 bg-primary text-gold px-4 py-2 rounded-full shadow-xl border border-gold/30"
        >
          Aktifkan Musik
        </button>
      )}

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center text-center px-6 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1590076214667-c0f33b98c442?q=80&w=2070&auto=format&fit=crop" 
            alt="Islamic Architecture" 
            className="w-full h-full object-cover opacity-20 scale-105"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-primary/40 via-secondary/80 to-secondary"></div>
          {/* Islamic Pattern Overlay */}
          <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/islamic-art.png")' }}></div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2 }}
          className="relative z-10 max-w-4xl"
        >
          <div className="flex justify-center mb-6">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: 'spring' }}
              className="w-24 h-24 border-2 border-accent rounded-full flex items-center justify-center p-2"
            >
              <div className="w-full h-full border border-accent/50 rounded-full flex items-center justify-center text-accent">
                <ShieldCheck size={40} />
              </div>
            </motion.div>
          </div>
          
          <span className="text-accent font-serif italic text-2xl mb-4 block tracking-widest">Undangan Silaturahmi Akbar</span>
          <h1 className="text-5xl md:text-8xl font-bold text-primary mb-6 leading-tight">
            DZURRIYAH <br />
            <span className="text-accent italic font-medium">SUNAN DRAJAD</span>
          </h1>
          <p className="text-xl md:text-2xl text-primary/80 mb-10 max-w-2xl mx-auto font-serif italic">
            "Membangun Kebersamaan, Menjaga Nasab, Mempererat Ukhuwah Keluarga Besar Se-Madura"
          </p>
          
          <div className="flex flex-wrap justify-center gap-4 mb-16">
            <CountdownItem label="Hari" value={timeLeft.days} />
            <CountdownItem label="Jam" value={timeLeft.hours} />
            <CountdownItem label="Menit" value={timeLeft.minutes} />
            <CountdownItem label="Detik" value={timeLeft.seconds} />
          </div>

          <motion.button 
            whileHover={{ y: 5 }}
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            onClick={() => document.getElementById('details')?.scrollIntoView({ behavior: 'smooth' })}
            className="text-accent flex flex-col items-center gap-2 mx-auto"
          >
            <span className="text-xs font-bold uppercase tracking-[0.3em]">Maklumat Acara</span>
            <ChevronDown size={28} />
          </motion.button>
        </motion.div>
      </section>

      {/* Details Section */}
      <section id="details" className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <BookOpen className="mx-auto text-accent mb-4" size={32} />
          <h2 className="text-4xl md:text-5xl font-bold text-primary mb-4">Agenda Silaturahmi</h2>
          <div className="w-24 h-1 bg-accent mx-auto"></div>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="ornament-border bg-white/50"
          >
            <div className="space-y-8">
              <div className="flex items-start gap-5">
                <div className="bg-primary text-gold p-4 rounded-lg shadow-md">
                  <Calendar size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-primary mb-1">Hari & Tanggal</h3>
                  <p className="text-lg text-neutral-700">Minggu, 29 Maret 2026</p>
                  <p className="text-sm text-accent font-medium italic">8 Syawal 1447 H (Perkiraan)</p>
                </div>
              </div>

              <div className="flex items-start gap-5">
                <div className="bg-primary text-gold p-4 rounded-lg shadow-md">
                  <Clock size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-primary mb-1">Waktu</h3>
                  <p className="text-lg text-neutral-700">Pukul 09.00 WIB – Selesai</p>
                </div>
              </div>

              <div className="flex items-start gap-5">
                <div className="bg-primary text-gold p-4 rounded-lg shadow-md">
                  <MapPin size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-primary mb-1">Lokasi Kediaman</h3>
                  <p className="text-lg text-neutral-700 font-bold">Rumah H. Taufiqur Rohman</p>
                  <p className="text-neutral-600">Perumahan Istana Tajmahal, Kec. Blega, Kab. Bangkalan, Madura</p>
                  <a 
                    href="https://www.google.com/maps/search/?api=1&query=-7.121360%2C113.072796" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-accent font-bold mt-4 hover:text-primary transition-colors border-b border-accent/30 pb-1"
                  >
                    Petunjuk Arah <ExternalLink size={16} />
                  </a>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Mobile-only map placement: right below lokasi kediaman */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="md:hidden glass-card overflow-hidden p-2 relative group"
          >
            <div className="relative w-full h-[320px] rounded-xl overflow-hidden shadow-inner">
              <iframe
                src="https://maps.google.com/maps?q=-7.121360,113.072796&z=18&output=embed"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen={true}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Map Preview Mobile"
              ></iframe>
              <div className="absolute bottom-4 right-4">
                <a
                  href="https://www.google.com/maps/search/?api=1&query=-7.121360%2C113.072796"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white text-primary px-4 py-3 rounded-lg shadow-xl font-bold flex items-center gap-2 hover:bg-primary hover:text-white transition-all"
                >
                  <MapPin size={18} /> Buka Navigasi
                </a>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <div className="bg-primary/5 p-8 rounded-2xl border-l-4 border-accent italic font-serif text-lg leading-relaxed text-primary">
              "Assalamu’alaikum Warahmatullahi Wabarakatuh. <br /><br />
              Puji syukur kehadirat Allah SWT, atas limpahan rahmat-Nya. Kami mengharap kehadiran seluruh Dzurriyah Sunan Drajad yang berada di wilayah Madura untuk hadir bersilaturahmi, mempererat tali persaudaraan yang telah terjalin turun-temurun."
            </div>
            <div className="pt-6">
              <p className="font-serif italic text-xl text-accent mb-2">Khidmah Kami,</p>
              <p className="text-2xl font-bold text-primary">Keluarga Besar Suudi bin Abd. Jabbar</p>
              <p className="text-sm text-neutral-500 mt-1 uppercase tracking-widest">Keturunan Sunan Drajad</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Map Preview Section */}
      <section className="hidden md:block max-w-5xl mx-auto px-6 pb-24">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-primary mb-2">Lokasi Acara</h2>
          <p className="text-neutral-500">Klik peta untuk interaksi lebih lanjut atau gunakan tombol navigasi</p>
        </div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card overflow-hidden p-2 relative group"
        >
          <div className="relative w-full h-[450px] rounded-xl overflow-hidden shadow-inner">
            <iframe 
              src="https://maps.google.com/maps?q=-7.121360,113.072796&z=18&output=embed" 
              width="100%" 
              height="100%" 
              style={{ border: 0 }} 
              allowFullScreen={true} 
              loading="lazy" 
              referrerPolicy="no-referrer-when-downgrade"
              title="Map Preview"
            ></iframe>
            
            {/* Overlay Buttons for Interactivity */}
            <div className="absolute bottom-6 right-6 flex flex-col gap-3">
              <a 
                href="https://www.google.com/maps/search/?api=1&query=-7.121360%2C113.072796" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-white text-primary px-4 py-3 rounded-lg shadow-xl font-bold flex items-center gap-2 hover:bg-primary hover:text-white transition-all transform hover:-translate-y-1"
              >
                <MapPin size={18} /> Buka Navigasi
              </a>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText("-7.121360, 113.072796");
                  alert("Alamat berhasil disalin!");
                }}
                className="bg-white text-primary px-4 py-3 rounded-lg shadow-xl font-bold flex items-center gap-2 hover:bg-accent hover:text-white transition-all transform hover:-translate-y-1"
              >
                <Plus size={18} /> Salin Alamat
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Registration Section */}
      <section className="max-w-4xl mx-auto px-6 py-24">
        <div className="bg-primary p-10 md:p-16 rounded-[2rem] shadow-2xl relative overflow-hidden">
          {/* Decorative background pattern */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/islamic-art.png")' }}></div>
          
          <div className="relative z-10">
            <div className="text-center mb-12">
              <Users className="mx-auto text-gold mb-4" size={40} />
              <h2 className="text-4xl font-bold text-gold mb-4">Daftar Kehadiran</h2>
              <p className="text-secondary/80 max-w-md mx-auto">Mohon kesediaan Bapak/Ibu/Saudara/i untuk mengisi maklumat kehadiran demi kelancaran persiapan acara.</p>
            </div>

            <div className="space-y-6">
              <AnimatePresence mode="popLayout">
                {attendees.map((attendee, index) => (
                  <motion.div 
                    key={attendee.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-xl p-6 relative shadow-lg"
                  >
                    <div className="absolute -left-3 -top-3 w-10 h-10 bg-accent text-white rounded-lg flex items-center justify-center font-bold shadow-lg transform -rotate-12">
                      {index + 1}
                    </div>
                    
                    {attendees.length > 1 && (
                      <button 
                        onClick={() => removeAttendee(attendee.id)}
                        className="absolute -right-3 -top-3 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-700 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}

                    <div className="grid md:grid-cols-2 gap-6 pt-2">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-primary/60">Nama Lengkap</label>
                        <input 
                          type="text" 
                          placeholder="Nama lengkap sesuai nasab"
                          className="input-field"
                          value={attendee.name}
                          onChange={(e) => updateAttendeeField(attendee.id, 'name', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-primary/60">Domisili / Alamat</label>
                        <input 
                          type="text" 
                          placeholder="Kota atau Kecamatan"
                          className="input-field"
                          value={attendee.address}
                          onChange={(e) => updateAttendeeField(attendee.id, 'address', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-primary/60">Jumlah Anggota Keluarga</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min={1}
                          className="input-field"
                          value={countDrafts[attendee.id] ?? String(attendee.count)}
                          onChange={(e) => {
                            setCountDrafts((prev) => ({
                              ...prev,
                              [attendee.id]: sanitizeCountInput(e.target.value),
                            }));
                          }}
                          onBlur={() => commitCountDraft(attendee.id)}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-primary/60">Total Kehadiran</label>
                          <span className="text-accent font-bold">{getEffectiveCount(attendee)} Orang</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              <button 
                onClick={addAttendee}
                className="w-full py-4 border-2 border-dashed border-gold/40 rounded-xl text-gold font-bold flex items-center justify-center gap-2 hover:bg-white/5 transition-all"
              >
                <Plus size={20} /> Tambah Anggota Keluarga Lain
              </button>

              <div className="pt-10">
                <button 
                  onClick={handleSendWhatsApp}
                  className="btn-primary w-full py-6 text-xl group"
                >
                  <Send size={24} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" /> 
                  Kirim Konfirmasi Kehadiran
                </button>
                <p className="text-center text-xs text-secondary/50 mt-6 italic">
                  "Barangsiapa yang beriman kepada Allah dan hari akhir, maka hendaklah ia menyambung tali silaturahmi." (HR. Bukhari & Muslim)
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Confirmed Attendees List Section */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-primary mb-2">Tamu yang Telah Mengonfirmasi</h2>
          <div className="w-16 h-1 bg-accent mx-auto mb-4"></div>
          <p className="text-neutral-500 italic">Jumlah pendaftar: {confirmedAttendees.length} Tamu</p>
          <p className="text-neutral-500 italic">Total: {confirmedAttendees.reduce((acc, curr) => acc + curr.count, 0)} Orang</p>
          {loadError && (
            <p className="mt-3 text-sm text-red-600">{loadError}</p>
          )}
          <button
            onClick={fetchAttendees}
            className="mt-3 inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-lg font-bold hover:bg-accent/20 transition-colors"
          >
            Muat Ulang Daftar Tamu
          </button>
          <button
            onClick={handleDownloadGuestList}
            className="mt-5 inline-flex items-center gap-2 bg-primary text-gold px-4 py-2 rounded-lg font-bold hover:opacity-90 transition-opacity"
          >
            <Download size={16} /> Download PDF Daftar Tamu
          </button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <div className="col-span-full text-center py-10 text-neutral-400">Memuat daftar tamu...</div>
          ) : confirmedAttendees.length > 0 ? (
            confirmedAttendees.map((attendee) => {
              const isEditing = editingAttendeeKey === attendee.uiKey;
              const isActing = actionAttendeeKey === attendee.uiKey;
              return (
              <motion.div 
                key={attendee.uiKey}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="bg-white p-4 rounded-xl shadow-sm border border-accent/10 flex flex-col justify-between"
              >
                <div>
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editDraft.name}
                        onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                        className="w-full border border-accent/30 rounded-md px-2 py-1 text-sm"
                        placeholder="Nama tamu"
                      />
                      <input
                        type="text"
                        value={editDraft.address}
                        onChange={(e) => setEditDraft({ ...editDraft, address: e.target.value })}
                        className="w-full border border-accent/30 rounded-md px-2 py-1 text-sm"
                        placeholder="Alamat"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min={1}
                        value={editCountDraft}
                        onChange={(e) => {
                          setEditCountDraft(sanitizeCountInput(e.target.value));
                        }}
                        onBlur={() => {
                          const normalized = normalizeParticipantCounts({ count: Number(editCountDraft || 1) });
                          setEditCountDraft(String(normalized.count));
                          setEditDraft({ ...editDraft, ...normalized });
                        }}
                        className="w-full border border-accent/30 rounded-md px-2 py-1 text-sm"
                        placeholder="Jumlah hadir"
                      />
                    </div>
                  ) : (
                    <>
                      <h4 className="font-bold text-primary truncate">{attendee.name}</h4>
                      <p className="text-xs text-neutral-500 flex items-center gap-1 mt-1">
                        <MapPin size={12} /> {attendee.address}
                      </p>
                    </>
                  )}
                </div>
                <div className="mt-3 border-t border-neutral-50 pt-2 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-neutral-400">
                      {attendee.created_at ? new Date(attendee.created_at).toLocaleDateString('id-ID') : ''}
                    </span>
                    <span className="bg-accent/10 text-accent text-xs font-bold px-2 py-1 rounded-full">
                      {(isEditing ? normalizeParticipantCounts({ count: Number(editCountDraft || editDraft.count || 1) }).count : attendee.count)} Orang
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => saveEditConfirmedAttendee(attendee)}
                          disabled={isActing}
                          className="px-2 py-1 text-xs rounded bg-primary text-gold font-bold disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          <Save size={12} /> Simpan
                        </button>
                        <button
                          onClick={cancelEditConfirmedAttendee}
                          disabled={isActing}
                          className="px-2 py-1 text-xs rounded bg-neutral-200 text-neutral-700 font-bold disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          <X size={12} /> Batal
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEditConfirmedAttendee(attendee)}
                          disabled={isActing}
                          className="px-2 py-1 text-xs rounded bg-accent/10 text-accent font-bold disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          onClick={() => deleteConfirmedAttendee(attendee)}
                          disabled={isActing}
                          className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 font-bold disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          <Trash2 size={12} /> Hapus
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
              );
            })
          ) : (
            <div className="col-span-full text-center py-10 text-neutral-400 italic">Belum ada tamu yang mengonfirmasi.</div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-24 py-16 text-center border-t border-accent/10 bg-primary/5">
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="w-16 h-16 bg-primary text-gold rounded-full flex items-center justify-center shadow-xl">
            <Heart size={32} fill="currentColor" />
          </div>
          <h3 className="font-serif italic text-3xl text-primary">Dzurriyah Sunan Drajad Se-Madura</h3>
        </div>
        <p className="text-sm text-neutral-500 tracking-[0.2em] uppercase">Membangun Peradaban Melalui Silaturahmi</p>
        <p className="text-xs text-neutral-400 mt-8">© 2026 - Keluarga Besar Suudi bin Abd. Jabbar</p>
      </footer>
    </div>
  );
}

function CountdownItem({ label, value }: { label: string, value: number }) {
  return (
    <div className="flex flex-col items-center bg-white/60 backdrop-blur-md px-6 py-4 rounded-xl min-w-[100px] shadow-lg border border-accent/20">
      <span className="text-4xl font-bold text-primary">{value}</span>
      <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-accent mt-1">{label}</span>
    </div>
  );
}
