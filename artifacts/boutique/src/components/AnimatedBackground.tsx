export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">

      {/* Vidéo de fond — centrée, couvre tout l'écran */}
      <video
        autoPlay
        loop
        muted
        playsInline
        disablePictureInPicture
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: "cover", objectPosition: "center center" }}
      >
        <source src={`${import.meta.env.BASE_URL}bg-video.mp4`} type="video/mp4" />
      </video>

      {/* Overlay sombre pour lisibilité du contenu */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(6,4,2,0.72)" }}
      />

      {/* Reflet doré ambient en haut */}
      <div className="absolute inset-x-0 top-0" style={{
        height: "45%",
        background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(201,160,76,0.07) 0%, transparent 70%)",
      }} />

      {/* Vignette haut */}
      <div className="absolute inset-x-0 top-0 h-20" style={{
        background: "linear-gradient(to bottom, rgba(6,4,2,0.55) 0%, transparent 100%)",
      }} />

      {/* Vignette bas */}
      <div className="absolute inset-x-0 bottom-0" style={{
        height: "40%",
        background: "linear-gradient(to top, rgba(6,4,2,0.88) 0%, transparent 100%)",
      }} />

      {/* Grain subtil */}
      <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" style={{
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }} />
    </div>
  );
}
