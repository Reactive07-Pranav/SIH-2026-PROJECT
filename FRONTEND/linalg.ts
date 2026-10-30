/** Solve Ax = b via Gaussian elimination with partial pivoting. */
export function solveLinear(Ain: number[][], bin: number[]): number[] {
  const n = bin.length
  const A = Ain.map(r => [...r])
  const b = [...bin]

  for (let col = 0; col < n; col++) {
    let piv = col
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r
    if (Math.abs(A[piv][col]) < 1e-12) throw new Error('Singular matrix in solveLinear')
    if (piv !== col) {
      const tmpRow = A[col]; A[col] = A[piv]; A[piv] = tmpRow
      const tmpB = b[col]; b[col] = b[piv]; b[piv] = tmpB
    }
    for (let r = col + 1; r < n; r++) {
      const f = A[r][col] / A[col][col]
      for (let c = col; c < n; c++) A[r][c] -= f * A[col][c]
      b[r] -= f * b[col]
    }
  }

  const x = new Array<number>(n).fill(0)
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r]
    for (let c = r + 1; c < n; c++) s -= A[r][c] * x[c]
    x[r] = s / A[r][r]
  }
  return x
}

/** Least squares: min ||M x − y||² via normal equations (MᵀM)x = Mᵀy. */
export function leastSquares(M: number[][], y: number[]): number[] {
  const rows = M.length, cols = M[0].length
  const MtM: number[][] = Array.from({ length: cols }, () => new Array<number>(cols).fill(0))
  const Mty: number[] = new Array<number>(cols).fill(0)
  for (let i = 0; i < rows; i++) {
    for (let a = 0; a < cols; a++) {
      Mty[a] += M[i][a] * y[i]
      for (let c = 0; c < cols; c++) MtM[a][c] += M[i][a] * M[i][c]
    }
  }
  return solveLinear(MtM, Mty)
}
