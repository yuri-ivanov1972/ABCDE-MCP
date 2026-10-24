export default function Architecture() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg font-body text-text px-[6vw] py-[8vh]">
      <h1 className="font-display text-[4vw] leading-[1.1] font-extrabold text-primary max-w-[88vw]">Claude is the interface. ABCDE.lv is the source.</h1>
      <div className="mt-[5vh] flex items-center gap-[1.6vw] text-[2.1vw] leading-[1.25]">
        <p className="bg-primary text-bg px-[2.4vw] py-[3vh]">Claude</p>
        <p className="text-primary">→</p>
        <p className="bg-sage text-primary px-[2.4vw] py-[3vh]">/mcp</p>
        <p className="text-primary">→</p>
        <p className="bg-primary text-bg px-[2.4vw] py-[3vh] flex-1">official TypeScript MCP SDK</p>
      </div>
      <p className="mt-[4vh] text-[2.3vw] leading-[1.25] text-primary font-semibold">Catalogue adapter → public ABCDE.lv API</p>
      <div className="mt-[4vh] space-y-[3vh] border-t border-rule pt-[4vh]">
        <p className="text-[2.1vw] leading-[1.3]">Normalization and local checks → structured tool results</p>
        <p className="text-[2.1vw] leading-[1.3]">PostgreSQL → durable aggregate counters and shared quotas</p>
        <p className="text-[2.1vw] leading-[1.3]">Separate landing page → connection instructions and usage statistics</p>
      </div>
    </div>
  );
}
