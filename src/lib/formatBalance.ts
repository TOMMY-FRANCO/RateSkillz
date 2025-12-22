export function formatCoinBalance(balance: number): string {
  if (balance >= 1000000) {
    return `${(balance / 1000000).toFixed(1)}M`;
  }
  if (balance >= 1000) {
    return `${(balance / 1000).toFixed(1)}K`;
  }
  return balance.toFixed(2);
}

export function formatCoinBalanceFull(balance: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(balance);
}

export function formatCoinBalanceWithLabel(balance: number): string {
  const formatted = formatCoinBalanceFull(balance);
  return `${formatted} coin${balance === 1 ? '' : 's'}`;
}
