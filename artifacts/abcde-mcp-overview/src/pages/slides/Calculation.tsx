export default function Calculation() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg font-body text-text px-[6vw] py-[7vh]">
      <h1 className="font-display leading-[1.05] font-extrabold text-primary">
        <span className="block text-[5.6vw]">113.01 g of protein.</span>
        <span className="block text-[3.2vw] mt-[1vh]">Calculated transparently.</span>
      </h1>
      <p className="mt-[3vh] text-[2vw] leading-[1.25]">Verified example: 2 × Rimi product 3975 + 1 × Maxima product 7451</p>
      <div className="mt-[3vh] grid grid-cols-2 gap-[2vw]">
        <p className="bg-primary text-bg px-[2.4vw] py-[3vh] text-[2.1vw] leading-[1.35]">Rimi: 11.10 g/100 g × 300 g × 2 packages = 66.60 g</p>
        <p className="bg-sage text-primary px-[2.4vw] py-[3vh] text-[2.1vw] leading-[1.35]">Maxima: 11.90 g/100 g × 390 g × 1 package = 46.41 g</p>
      </div>
      <p className="mt-[3vh] text-[2.5vw] leading-[1.25] font-semibold text-primary">Total: 113.01 g; Nutri-Score package counts: B × 2, D × 1</p>
      <p className="mt-[3vh] text-[2vw] leading-[1.3]">When any package is unresolved, show a known partial sum—not a complete total</p>
      <p className="mt-[3vh] text-[1.5vw] leading-[1.3] text-muted">Example verified in development on 24 October 2026; catalogue data may change</p>
    </div>
  );
}
