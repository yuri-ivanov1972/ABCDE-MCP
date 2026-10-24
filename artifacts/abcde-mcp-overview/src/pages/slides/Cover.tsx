export default function Cover() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg font-body text-text">
      <div className="absolute left-[6vw] right-[6vw] top-[8vh] h-[0.2vh] bg-rule" />
      <div className="absolute left-[6vw] top-[18vh] right-[6vw]">
        <h1 className="font-display text-[10vw] leading-[1.05] font-extrabold text-primary">ABCDE MCP</h1>
        <p className="mt-[4vh] max-w-[77vw] text-[3.2vw] leading-[1.25]">Nutrition-aware shopping lists with Claude.</p>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[29vh] bg-primary px-[6vw] py-[5vh] text-bg">
        <p className="text-[2.2vw] leading-[1.35]">An independent project by ABCDE Open Food Data Lab.</p>
        <p className="mt-[3vh] text-[2vw] leading-[1.3] text-accent">Development-verified • Publication pending</p>
      </div>
    </div>
  );
}
