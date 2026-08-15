export function BackgroundOverlays() {
  return (
    <>
      {/* Noise overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03] z-50"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")',
        }}
      />

      {/* Ambient floating orbs */}
      <div className="fixed top-[-100px] left-[-100px] w-[400px] h-[400px] rounded-full pointer-events-none -z-10"
        style={{
          background: 'radial-gradient(circle, rgba(212, 165, 116, 0.08) 0%, rgba(8, 20, 37, 0) 70%)',
          filter: 'blur(60px)',
          animation: 'aura-orb-drift-404 20s infinite alternate ease-in-out',
        }}
      />
      <div className="fixed bottom-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full pointer-events-none -z-10"
        style={{
          background: 'radial-gradient(circle, rgba(212, 165, 116, 0.06) 0%, rgba(8, 20, 37, 0) 70%)',
          filter: 'blur(60px)',
          animation: 'aura-orb-drift-404 20s infinite alternate-reverse ease-in-out 10s',
        }}
      />

      {/* Background atmospheric image */}
      <div className="fixed inset-0 -z-20 opacity-20 grayscale pointer-events-none">
        <div
          className="w-full h-full bg-cover bg-center"
          style={{
            backgroundImage:
              'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDloQ_C_dQR_slTZga2tQ9VSEjVJudYi6IPeLpnwnC7hDfuqVEcjpXJsgWXOGRIK4L5UsfTo6dkaUBJqnWKhmIufoXxYtSXMMmlTkFKcGC0ZAreqadMGwJLnILh5y39wDCXGjl0mDpIL1f0zGjOa1Y-sYD8qHTG2YHH3PvebfGCNmvFOpl8ng2JZkdA-0XrdqEkE7XC8TP56cnAl_yPI_Wcp_P55FVtONwTJPpIgpKfvzUGH126MnsPZVcksY76m9ZDU8wZnnywXR4")',
          }}
        />
      </div>
    </>
  );
}
