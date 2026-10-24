export default function Tools() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg font-body text-text px-[6vw] py-[8vh]">
      <h1 className="font-display text-[4.5vw] leading-[1.08] font-extrabold text-primary max-w-[82vw]">Three tools. One read-only workflow.</h1>
      <div className="mt-[8vh] grid grid-cols-3 gap-[4vw]">
        <p className="text-[2.1vw] leading-[1.45] border-t-[0.3vh] border-primary pt-[3vh]"><strong className="font-display font-extrabold text-primary">search_products</strong> — bounded product search with locally checked nutrition filters</p>
        <p className="text-[2.1vw] leading-[1.45] border-t-[0.3vh] border-primary pt-[3vh]"><strong className="font-display font-extrabold text-primary">get_product</strong> — available nutrition, ingredients, package details, and retailer links</p>
        <p className="text-[2.1vw] leading-[1.45] border-t-[0.3vh] border-primary pt-[3vh]"><strong className="font-display font-extrabold text-primary">build_basket</strong> — retailer-grouped shopping lists with protein estimates and unresolved items</p>
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-primary px-[6vw] py-[5vh]">
        <p className="text-[2.2vw] leading-[1.3] text-bg">No accounts, carts, checkout, or upstream modifications</p>
      </div>
    </div>
  );
}
