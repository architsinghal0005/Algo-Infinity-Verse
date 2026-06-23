$ErrorActionPreference = 'Stop'
$c = Get-Content -Raw -Path 'script.js'
# JS parse check using a browser-like parser is not available; best-effort check:
# 1) Ensure file is not obviously truncated by checking last non-whitespace char.
$trimmed = $c.Trim()
if ([string]::IsNullOrWhiteSpace($trimmed)) { throw 'script.js is empty/whitespace' }
# 2) Basic bracket/paren balance heuristic (not perfect, but catches many truncation issues)
$stack = New-Object System.Collections.Stack
$map = @{}
$map[')'] = '('
$map[']'] = '['
$map['}'] = '{'
$opens = @{}
$opens['('] = 1
$opens['['] = 1
$opens['{'] = 1
foreach($ch in $trimmed.ToCharArray()){
  if($opens.ContainsKey($ch)){ $stack.Push($ch) }
  elseif($map.ContainsKey($ch)){
    if($stack.Count -eq 0){ throw "Unmatched closing bracket: $ch" }
    $top = $stack.Pop()
    if($top -ne $map[$ch]){ throw "Mismatched brackets: expected $($map[$ch]) got $top" }
  }
}

if($stack.Count -gt 0){ throw 'Unmatched opening bracket(s) remain' }
'OK: script.js basic structure heuristic passed'

