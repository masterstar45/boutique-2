export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Image de fond */}
      <img
        src={`${import.meta.env.BASE_URL}bg.png`}
        alt=""
        className="absolute inset-0 w-full h-full object-cover object-center"
        style={{ imageRendering: "auto" }}
      />
      {/* Overlay sombre pour la lisibilité */}
      <div className="absolute inset-0 bg-black/65" />
      {/* Légère teinte violette qui correspond à l'image */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-950/20 via-transparent to-black/40" />
    </div>
  );
}
