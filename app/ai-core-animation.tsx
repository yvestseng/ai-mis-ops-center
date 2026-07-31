"use client";

export function AiCoreAnimation() {
  return (
    <div className="ai-core-animation" role="img" aria-label="運作中的 AI 智慧核心動畫">
      <div className="ai-core-shadow" />
      <div className="ai-orbit ai-orbit-one"><i /><i /><i /></div>
      <div className="ai-orbit ai-orbit-two"><i /><i /></div>
      <div className="ai-orbit ai-orbit-three"><i /></div>
      <div className="ai-core-pulse ai-core-pulse-one" />
      <div className="ai-core-pulse ai-core-pulse-two" />
      <div className="ai-core-sphere"><span>AI</span><b /></div>
      <div className="ai-core-platform">
        <div className="ai-platform-ring ai-platform-ring-one" />
        <div className="ai-platform-ring ai-platform-ring-two" />
        <div className="ai-platform-base" />
      </div>
    </div>
  );
}
