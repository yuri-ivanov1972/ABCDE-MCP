export default function Safeguards() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg font-body text-text px-[6vw] py-[8vh]">
      <h1 className="font-display text-[4.5vw] leading-[1.08] font-extrabold text-primary max-w-[88vw]">Bounded requests. Minimal application data.</h1>
      <div className="mt-[6vh] grid grid-cols-2 gap-[4vw]">
        <div className="space-y-[3.2vh]">
          <p className="text-[2vw] leading-[1.3]"><strong className="text-primary">60-second cache;</strong> identical in-flight requests are coalesced</p>
          <p className="text-[2vw] leading-[1.3]">Per instance: 2 concurrent upstream requests and 2 starts per second</p>
          <p className="text-[2vw] leading-[1.3]">Shared limits: 60 upstream starts and 120 tool attempts per minute</p>
          <p className="text-[2vw] leading-[1.3]">10-second upstream attempts within a 30-second tool deadline</p>
        </div>
        <div className="space-y-[4vh] border-l border-rule pl-[4vw]">
          <p className="text-[2vw] leading-[1.3]">Host/Origin checks, bounded payloads, safe retries, and cancellation</p>
          <p className="text-[2vw] leading-[1.3]">Aggregate counters only; no stored queries or session IDs, and no invented session counts</p>
          <p className="text-[2vw] leading-[1.3] text-muted">Infrastructure operational logs may exist</p>
        </div>
      </div>
    </div>
  );
}
