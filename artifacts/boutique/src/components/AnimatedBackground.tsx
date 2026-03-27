import { motion } from "framer-motion";

export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-background pointer-events-none">
      {/* Background Image Glow */}
      <img 
        src={`${import.meta.env.BASE_URL}images/bg-glow.png`}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-screen"
      />

      {/* Floating Orbs */}
      <motion.div
        animate={{
          x: [0, 50, 0],
          y: [0, 30, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-[20%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-primary/10 blur-[100px]"
      />
      <motion.div
        animate={{
          x: [0, -30, 0],
          y: [0, 40, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute top-[40%] -right-[10%] w-[40vw] h-[40vw] rounded-full bg-emerald-900/20 blur-[120px]"
      />
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
    </div>
  );
}
