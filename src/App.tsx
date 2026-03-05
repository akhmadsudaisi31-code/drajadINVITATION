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
  BookOpen
} from 'lucide-react';

interface Attendee {
  id: string;
  name: string;
  address: string;
  count: number;
  created_at?: string;
}

const EVENT_DATE = new Date('2026-03-29T09:00:00');
const WHATSAPP_NUMBER = '6281234567890'; 

export default function App() {
  const [attendees, setAttendees] = useState<Attendee[]>([
    { id: '1', name: '', address: '', count: 1 }
  ]);
  const [confirmedAttendees, setConfirmedAttendees] = useState<Attendee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    fetchAttendees();
    const timer = setInterval(() => {
      const now = new Date();
      const difference = EVENT_DATE.getTime() - now.getTime();

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const fetchAttendees = async () => {
    try {
      const response = await fetch('/api/attendees');
      if (response.ok) {
        const data = await response.json();
        setConfirmedAttendees(data);
      }
    } catch (error) {
      console.error("Error fetching confirmed attendees:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const addAttendee = () => {
    setAttendees([
      ...attendees,
      { id: Math.random().toString(36).substr(2, 9), name: '', address: '', count: 1 }
    ]);
  };

  const removeAttendee = (id: string) => {
    if (attendees.length > 1) {
      setAttendees(attendees.filter(a => a.id !== id));
    }
  };

  const updateAttendee = (id: string, field: keyof Attendee, value: string | number) => {
    setAttendees(attendees.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const handleSendWhatsApp = async () => {
    // Save to database first
    try {
      const validAttendees = attendees.filter(a => a.name.trim());
      if (validAttendees.length > 0) {
        await fetch('/api/attendees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attendees: validAttendees })
        });
        fetchAttendees(); // Refresh list
      }
    } catch (error) {
      console.error("Error saving attendees:", error);
    }

    let message = `Assalamu’alaikum Warahmatullahi Wabarakatuh.\n\n`;
    message += `Saya ingin mengonfirmasi kehadiran untuk acara:\n`;
    message += `*SILATURAHMI DZURRIYAH SUNAN DRAJAD SE-MADURA*\n`;
    message += `(Reuni Keluarga Besar Drajad Madura)\n\n`;
    message += `*DAFTAR HADIR*\n\n`;

    attendees.forEach((a, index) => {
      if (a.name.trim()) {
        message += `${index + 1}. Nama : ${a.name}\n`;
        message += `   Alamat : ${a.address}\n`;
        message += `   Jumlah hadir : ${a.count}\n\n`;
      }
    });

    message += `Terima kasih.\nWassalamu’alaikum Warahmatullahi Wabarakatuh.`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`, '_blank');
  };

  return (
    <div className="min-h-screen pb-20 overflow-x-hidden selection:bg-accent selection:text-white">
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
                    href="https://maps.app.goo.gl/zbqf9Vf62SF3n6sC6" 
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
      <section className="max-w-5xl mx-auto px-6 pb-24">
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
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3959.456846387031!2d113.0886234!3d-7.0729111!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2dd7f94e63f963f9%3A0x10f63f963f963f96!2sPerumahan%20Istana%20Tajmahal!5e0!3m2!1sid!2sid!4v1709641184000!5m2!1sid!2sid" 
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
                href="https://maps.app.goo.gl/zbqf9Vf62SF3n6sC6" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-white text-primary px-4 py-3 rounded-lg shadow-xl font-bold flex items-center gap-2 hover:bg-primary hover:text-white transition-all transform hover:-translate-y-1"
              >
                <MapPin size={18} /> Buka Navigasi
              </a>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText("Perumahan Istana Tajmahal, Kec. Blega, Kab. Bangkalan, Madura");
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
                          onChange={(e) => updateAttendee(attendee.id, 'name', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-primary/60">Domisili / Alamat</label>
                        <input 
                          type="text" 
                          placeholder="Kota atau Kecamatan"
                          className="input-field"
                          value={attendee.address}
                          onChange={(e) => updateAttendee(attendee.id, 'address', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-primary/60">Jumlah Anggota Keluarga</label>
                          <span className="text-accent font-bold">{attendee.count} Orang</span>
                        </div>
                        <div className="flex items-center gap-6">
                          <input 
                            type="range" 
                            min="1" 
                            max="15" 
                            className="flex-1 accent-accent h-2 bg-neutral-100 rounded-lg appearance-none cursor-pointer"
                            value={attendee.count}
                            onChange={(e) => updateAttendee(attendee.id, 'count', parseInt(e.target.value))}
                          />
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
          <p className="text-neutral-500 italic">Total: {confirmedAttendees.reduce((acc, curr) => acc + curr.count, 0)} Orang</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <div className="col-span-full text-center py-10 text-neutral-400">Memuat daftar tamu...</div>
          ) : confirmedAttendees.length > 0 ? (
            confirmedAttendees.map((attendee) => (
              <motion.div 
                key={attendee.id}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="bg-white p-4 rounded-xl shadow-sm border border-accent/10 flex flex-col justify-between"
              >
                <div>
                  <h4 className="font-bold text-primary truncate">{attendee.name}</h4>
                  <p className="text-xs text-neutral-500 flex items-center gap-1 mt-1">
                    <MapPin size={12} /> {attendee.address}
                  </p>
                </div>
                <div className="mt-3 flex justify-between items-center border-t border-neutral-50 pt-2">
                  <span className="text-[10px] text-neutral-400">
                    {attendee.created_at ? new Date(attendee.created_at).toLocaleDateString('id-ID') : ''}
                  </span>
                  <span className="bg-accent/10 text-accent text-xs font-bold px-2 py-1 rounded-full">
                    {attendee.count} Orang
                  </span>
                </div>
              </motion.div>
            ))
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
