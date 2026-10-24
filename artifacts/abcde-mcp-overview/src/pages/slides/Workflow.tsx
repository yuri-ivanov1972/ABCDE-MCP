export default function Workflow() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg font-body text-text px-[6vw] py-[8vh]">
      <h1 className="font-display text-[4.5vw] leading-[1.08] font-extrabold text-primary max-w-[86vw]">From a food question to a shopping list</h1>
      <div className="mt-[5vh] grid grid-cols-[4vw_1fr] gap-x-[2vw]">
        <p className="text-[2.5vw] font-semibold text-primary py-[2vh]">01</p>
        <p className="text-[2.2vw] leading-[1.25] py-[2vh] border-b border-rule">Connect Claude to the public, read-only MCP endpoint</p>
        <p className="text-[2.5vw] font-semibold text-primary py-[2vh]">02</p>
        <p className="text-[2.2vw] leading-[1.25] py-[2vh] border-b border-rule">Ask about food and nutrition across Rimi and Maxima</p>
        <p className="text-[2.5vw] font-semibold text-primary py-[2vh]">03</p>
        <p className="text-[2.2vw] leading-[1.25] py-[2vh] border-b border-rule">Review original product names, nutrition data, and package quantities</p>
        <p className="text-[2.5vw] font-semibold text-primary py-[2vh]">04</p>
        <p className="text-[2.2vw] leading-[1.25] py-[2vh]">Follow retailer links to shop; Maxima links may lead to Barbora</p>
      </div>
      <p className="mt-[3vh] text-[2vw] leading-[1.25] text-muted">Latvian-first landing page with an English switch</p>
    </div>
  );
}
