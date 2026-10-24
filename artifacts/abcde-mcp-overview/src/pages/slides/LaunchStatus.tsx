export default function LaunchStatus() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg font-body text-text px-[6vw] py-[8vh]">
      <h1 className="font-display text-[4.5vw] leading-[1.08] font-extrabold text-primary max-w-[88vw]">Built and tested. Public launch comes next.</h1>
      <div className="mt-[6vh] grid grid-cols-2 gap-[4vw]">
        <div className="space-y-[4vh]">
          <p className="text-[2vw] leading-[1.3] border-t-[0.3vh] border-primary pt-[3vh]">Passed: 20 automated tests, workspace typechecks, and production builds</p>
          <p className="text-[2vw] leading-[1.3]">Passed: official MCP client checks for legacy and modern negotiation</p>
          <p className="text-[2vw] leading-[1.3]">Passed: live tool calls, partial/error cases, and counters surviving restart</p>
        </div>
        <div className="space-y-[4vh]">
          <p className="text-[2vw] leading-[1.3] border-t-[0.3vh] border-primary pt-[3vh]">Next: publish, confirm the actual public /mcp URL, and test a real Claude account</p>
          <p className="text-[2vw] leading-[1.3]">Further checks: multi-instance load, cache pressure, and manual accessibility/clipboard testing</p>
          <p className="text-[2vw] leading-[1.3] text-muted">Independent of Rimi, Maxima, and Barbora; purchases happen on retailer sites</p>
        </div>
      </div>
    </div>
  );
}
