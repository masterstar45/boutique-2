export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">

      {/* Vidéo de fond */}
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

      {/* Overlay principal — réduit pour laisser respirer la vidéo */}
      <div className="absolute inset-0" style={{ background: "rgba(6,4,2,0.55)" }} />

      {/* Vignette haut — fondu discret */}
      <div className="absolute inset-x-0 top-0 h-32" style={{
        background: "linear-gradient(to bottom, rgba(6,4,2,0.70) 0%, transparent 100%)",
      }} />

      {/* Vignette bas — plus prononcée pour lisibilité du contenu */}
      <div className="absolute inset-x-0 bottom-0" style={{
        height: "50%",
        background: "linear-gradient(to top, rgba(6,4,2,0.92) 0%, rgba(6,4,2,0.4) 55%, transparent 100%)",
      }} />

      {/* Vignettes latérales cinématiques */}
      <div className="absolute inset-y-0 left-0 w-12" style={{
        background: "linear-gradient(to right, rgba(6,4,2,0.45) 0%, transparent 100%)",
      }} />
      <div className="absolute inset-y-0 right-0 w-12" style={{
        background: "linear-gradient(to left, rgba(6,4,2,0.45) 0%, transparent 100%)",
      }} />

      {/* Reflet doré ambient — centre haut */}
      <div className="absolute inset-x-0 top-0" style={{
        height: "55%",
        background: "radial-gradient(ellipse 70% 55% at 50% 0%, rgba(201,160,76,0.09) 0%, transparent 70%)",
      }} />

      {/* Reflet doré ambient — centre (warmth général) */}
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse 90% 60% at 50% 50%, rgba(201,160,76,0.03) 0%, transparent 65%)",
      }} />

      {/* Grain cinématique premium */}
      <div className="absolute inset-0 mix-blend-overlay" style={{
        opacity: 0.04,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='256' height='256' filter='url(%23n)'/%3E%3C/svg%3E\")",
        backgroundRepeat: "repeat",
      }} />
    </div>
  );
}
