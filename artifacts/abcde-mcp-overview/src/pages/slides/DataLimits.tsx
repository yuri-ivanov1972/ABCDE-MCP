export default function DataLimits() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg font-body text-text px-[6vw] py-[8vh]">
      <h1 className="font-display text-[4.5vw] leading-[1.08] font-extrabold text-primary max-w-[88vw]">Useful nutrition data—with explicit limits</h1>
      <div className="mt-[6vh] grid grid-cols-2 gap-[4vw]">
        <div className="space-y-[4vh]">
          <p className="text-[2.1vw] leading-[1.32] border-t border-rule pt-[3vh]">Original product names stay unchanged</p>
          <p className="text-[2.1vw] leading-[1.32] border-t border-rule pt-[3vh]">Missing or invalid values remain unknown; real zero stays zero</p>
          <p className="text-[2.1vw] leading-[1.32] border-t border-rule pt-[3vh]">Mass products use an assumed per-100-g basis when the source is silent</p>
        </div>
        <div className="space-y-[4vh]">
          <p className="text-[2.1vw] leading-[1.32] border-t border-rule pt-[3vh]">Volume, pieces, and unknown package bases do not produce protein totals</p>
          <p className="text-[2.1vw] leading-[1.32] border-t border-rule pt-[3vh]">Searches check at most 3 pages × 100 candidates; results are not exhaustive</p>
          <p className="text-[2.1vw] leading-[1.32] border-t border-rule pt-[3vh]">No verified prices, guaranteed live stock, medical advice, or allergen guarantees</p>
        </div>
      </div>
    </div>
  );
}
