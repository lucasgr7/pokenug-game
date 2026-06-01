<script lang="ts">
	import type { CardKind } from '$lib/game/types';

	let {
		id,
		kind,
		element = null,
		color,
		size = 40
	}: { id?: string; kind: CardKind; element?: string | null; color: string; size?: number } = $props();
</script>

{#if id === 'power_dragonize'}
	<svg
		width={size}
		height={size}
		viewBox="0 0 1280 1280"
		fill={color}
		aria-hidden="true"
	>
		<g transform="translate(0.000000,1280.000000) scale(0.100000,-0.100000)"
 stroke="none">
<path d="M8905 12411 c-119 -32 -211 -75 -362 -170 -62 -38 -134 -81 -160 -95
-27 -13 -67 -42 -89 -64 -109 -106 -716 -897 -1203 -1569 -9 -12 -18 -23 -21
-23 -3 0 -14 48 -24 108 -9 59 -20 117 -23 130 -5 20 -2 22 33 22 l38 0 -21
21 c-36 37 -130 37 -233 0 -91 -32 -101 -41 -157 -135 -61 -102 -423 -819
-423 -837 0 -9 -7 -22 -15 -29 -18 -15 -20 -51 -3 -68 9 -9 7 -13 -5 -18 -24
-9 -22 -115 3 -269 37 -221 23 -614 -31 -860 -27 -126 -98 -345 -112 -349 -7
-2 -49 -10 -95 -19 -80 -15 -187 -58 -235 -93 -21 -15 -19 -16 44 -10 55 5
216 -8 227 -19 2 -2 -8 -39 -21 -82 -14 -43 -28 -96 -32 -118 -11 -57 -16 -62
-30 -28 -21 49 -72 99 -127 124 -45 20 -69 24 -153 24 -89 0 -107 -4 -162 -29
-93 -42 -99 -56 -27 -56 58 0 165 -25 220 -52 67 -32 96 -122 68 -212 -16 -52
-16 -57 0 -101 10 -25 31 -56 47 -67 16 -12 29 -31 29 -43 0 -11 17 -43 38
-71 118 -157 215 -445 277 -821 20 -117 46 -263 59 -325 35 -165 38 -200 26
-333 -26 -300 -71 -465 -177 -650 -111 -193 -196 -309 -312 -425 -151 -150
-267 -284 -296 -340 -13 -25 -40 -98 -60 -163 -34 -108 -40 -119 -69 -131 -27
-11 -36 -10 -74 8 -23 11 -41 25 -38 31 19 46 20 44 -18 34 -24 -7 -42 -6 -56
1 -11 6 -20 12 -20 14 0 1 22 27 50 57 27 30 50 57 50 62 0 9 -63 0 -155 -23
-48 -13 -74 -15 -82 -8 -21 17 -15 24 27 37 21 6 42 16 45 21 6 9 -48 16 -104
12 -13 -1 -30 6 -37 16 -18 24 -17 29 7 35 27 7 199 110 199 119 0 3 -28 -2
-62 -13 -137 -42 -158 -48 -158 -44 0 24 33 61 77 86 29 17 53 31 53 32 0 2
-18 1 -40 -1 -57 -6 -52 22 10 53 72 36 271 196 252 203 -6 2 -50 -11 -98 -27
-120 -42 -124 -42 -111 12 7 33 18 47 48 66 21 14 56 43 76 64 l38 40 -45 -7
c-25 -3 -55 -9 -68 -12 -20 -6 -22 -4 -18 17 3 13 8 41 11 61 5 35 12 40 83
78 158 83 158 101 1 109 -94 6 -102 8 -110 28 -7 18 -4 26 14 37 126 77 182
118 239 174 87 84 88 97 7 88 -33 -4 -71 -11 -83 -16 -23 -8 -222 -40 -255
-40 -10 0 -23 11 -29 25 -10 22 -7 29 41 74 59 57 50 64 -43 31 l-55 -19 -22
27 c-12 15 -22 30 -23 34 0 4 14 28 30 55 30 48 60 156 48 169 -9 9 -74 -32
-126 -80 -57 -52 -74 -39 -43 34 22 51 22 52 5 143 -10 51 -20 96 -24 100 -11
13 -106 -68 -141 -120 -18 -26 -33 -49 -34 -51 -6 -7 -125 33 -125 42 0 34
-32 212 -39 219 -9 9 -77 -141 -83 -182 -2 -19 -12 -27 -37 -34 -44 -11 -51 0
-51 78 0 68 -16 138 -31 133 -17 -6 -80 -156 -88 -206 -6 -43 -10 -49 -51 -69
-57 -28 -59 -28 -70 2 -13 34 -17 32 -30 -15 -6 -22 -14 -40 -18 -40 -4 0 -16
16 -26 35 -10 19 -27 42 -36 50 -16 15 -18 12 -24 -43 -4 -32 -4 -65 -1 -73 7
-20 -61 -57 -77 -41 -17 17 -1 58 38 102 20 22 33 40 30 40 -4 0 -32 -12 -63
-26 -52 -25 -58 -31 -87 -96 -23 -53 -34 -67 -46 -62 -8 4 -30 9 -49 12 -31 4
-33 3 -26 -19 4 -13 8 -26 8 -29 2 -10 -48 -80 -58 -80 -5 0 -23 -23 -40 -51
-16 -27 -42 -65 -57 -82 -26 -31 -28 -31 -41 -13 -14 19 -15 19 -26 -2 -25
-46 -71 -7 -71 60 0 29 -7 46 -30 70 -37 38 -46 68 -30 98 9 17 9 25 0 34 -9
8 -17 4 -36 -19 -27 -33 -32 -98 -13 -153 10 -28 7 -38 -22 -89 -18 -32 -37
-61 -41 -64 -5 -3 -6 -13 -3 -21 10 -25 -11 -30 -45 -13 -34 18 -41 5 -16 -31
13 -19 12 -22 -20 -48 -23 -18 -41 -25 -54 -21 -11 4 -20 2 -20 -2 0 -12 78
-85 112 -106 36 -22 62 -73 59 -116 -4 -68 -194 -266 -266 -278 -48 -8 -65
-34 -54 -81 5 -20 9 -69 9 -109 0 -114 16 -172 61 -216 29 -30 45 -38 66 -35
22 2 29 9 31 31 2 15 9 27 16 27 8 0 16 10 20 22 4 18 8 20 17 11 9 -9 9 -16
-1 -28 -15 -18 -15 -70 0 -110 l10 -27 44 40 c25 23 71 54 103 70 79 41 109
71 143 146 50 112 128 179 318 275 45 22 88 41 96 41 29 0 80 56 108 117 25
55 28 74 28 162 0 75 4 101 15 111 8 7 15 25 15 39 0 16 10 37 25 51 14 13 25
31 25 39 1 23 66 61 103 61 20 0 39 8 50 20 9 11 28 20 42 20 14 0 25 4 25 10
0 16 78 4 100 -15 10 -9 24 -14 29 -10 6 3 15 -5 21 -19 5 -14 13 -26 18 -26
11 0 32 -61 32 -93 0 -15 4 -27 10 -27 6 0 6 -9 0 -26 -17 -43 -13 -66 10 -59
19 6 18 4 -5 -47 -29 -61 -31 -88 -10 -88 10 0 -1 -22 -35 -66 -55 -72 -60
-84 -30 -84 37 0 21 -27 -61 -101 -87 -78 -159 -162 -159 -185 0 -8 9 -14 21
-14 30 0 20 -33 -47 -143 -48 -81 -84 -167 -84 -204 0 -7 9 -13 20 -13 17 0
20 -7 20 -43 0 -23 -4 -57 -10 -76 -17 -59 -30 -183 -24 -218 5 -26 11 -33 30
-33 12 0 26 -6 31 -12 4 -7 10 -70 13 -140 6 -135 15 -158 56 -158 30 0 30
-14 3 -82 -32 -81 -37 -103 -27 -121 5 -10 18 -17 28 -17 30 0 31 -15 5 -72
-33 -70 -32 -85 6 -93 26 -6 30 -10 24 -28 -4 -12 -8 -38 -9 -57 -1 -31 2 -35
27 -38 26 -3 27 -5 25 -57 -2 -60 10 -82 49 -87 18 -2 29 -11 34 -28 3 -14 12
-43 18 -66 15 -57 53 -96 85 -88 21 5 27 0 46 -43 33 -75 88 -125 114 -104 9
8 17 7 29 -2 13 -10 14 -24 7 -97 -10 -89 -2 -201 24 -346 42 -237 41 -483 -4
-625 -11 -35 -20 -71 -20 -80 0 -31 -55 -70 -120 -85 -84 -19 -159 -61 -183
-101 -10 -18 -24 -33 -30 -33 -18 0 -78 -51 -98 -84 -23 -37 -25 -53 -4 -36
12 10 15 9 15 -6 0 -15 6 -12 33 14 38 37 72 42 80 12 7 -27 32 -25 113 5 91
34 103 33 95 -7 -8 -35 -16 -37 -87 -23 -26 6 -34 2 -53 -22 -12 -15 -49 -56
-83 -90 -58 -59 -75 -89 -101 -175 -9 -31 -8 -45 9 -84 24 -58 45 -70 37 -21
-3 21 1 45 11 65 21 41 36 41 30 0 -4 -23 2 -47 18 -78 31 -59 43 -60 41 -3
-2 54 17 93 53 110 23 11 24 10 19 -10 -4 -12 -18 -44 -33 -72 -34 -64 -37
-146 -7 -190 l20 -30 3 27 c2 17 9 28 18 28 9 0 14 8 13 18 -3 26 11 52 30 52
9 0 41 25 71 55 30 30 59 55 65 55 5 0 -2 -10 -17 -23 -51 -42 -74 -158 -43
-217 18 -35 35 -39 35 -10 0 37 28 79 49 73 13 -3 43 17 102 71 79 72 83 74
96 56 16 -22 47 -25 88 -10 26 10 26 9 20 -20 -9 -41 5 -38 44 10 36 45 47 49
56 19 7 -20 12 -21 64 -16 31 3 76 14 101 26 25 11 65 21 90 21 25 1 61 7 81
14 62 22 242 136 279 177 l35 38 41 -14 c73 -25 212 -41 234 -27 31 19 48 14
66 -19 12 -25 18 -29 25 -18 5 8 6 29 3 47 -7 36 -6 37 66 21 33 -7 50 -16 50
-26 0 -11 5 -13 18 -8 25 11 34 10 182 -18 74 -15 156 -37 181 -49 43 -21 47
-27 58 -75 7 -30 9 -72 6 -98 -8 -48 -2 -54 33 -29 44 30 54 69 60 224 3 80 5
175 4 211 l-1 66 57 -14 c37 -9 105 -13 193 -11 l136 2 39 -32 c84 -67 296
-157 440 -187 197 -41 918 -37 1124 7 52 11 162 26 244 35 145 14 150 14 200
-6 111 -45 366 -121 451 -135 354 -56 339 -56 441 -7 80 38 131 84 201 184 44
64 57 91 61 128 9 94 -58 212 -161 283 -29 20 -122 63 -207 95 -85 33 -175 69
-199 81 -77 38 -133 50 -238 50 l-103 0 -22 43 -23 42 -3 -42 -3 -41 -59 -4
c-58 -3 -60 -2 -66 25 -7 32 -24 26 -24 -9 0 -23 -3 -24 -65 -24 -62 0 -66 1
-76 27 -6 15 -20 43 -32 63 -21 34 -21 34 -28 10 -4 -14 -7 -40 -8 -57 -1 -27
-5 -33 -23 -33 -17 0 -28 11 -42 43 l-19 42 -9 -42 -9 -43 -64 0 c-60 0 -65 2
-78 27 l-15 27 -7 -32 c-10 -47 -21 -32 -35 45 -20 119 -31 163 -40 158 -4 -2
-13 -57 -20 -120 l-13 -115 -31 0 c-17 0 -47 3 -67 6 -33 6 -37 10 -48 56 -8
28 -18 47 -25 45 -6 -2 -24 -22 -41 -45 -34 -46 -55 -53 -55 -19 0 12 -3 32
-6 45 -5 18 -9 20 -21 10 -8 -6 -21 -25 -29 -41 l-15 -29 -77 7 c-42 4 -80 9
-84 12 -5 2 1 22 12 43 31 62 24 65 -38 16 -32 -25 -62 -46 -66 -46 -5 0 -5
11 -2 25 8 30 -4 32 -29 5 -10 -11 -31 -20 -48 -20 -33 0 -34 -8 7 123 14 42
21 77 16 77 -5 0 -46 -41 -92 -90 -72 -77 -89 -90 -116 -90 l-33 0 16 30 c24
46 18 53 -20 24 l-35 -26 41 81 c23 45 40 84 37 86 -3 3 -40 -31 -83 -75 -60
-62 -82 -79 -97 -74 -13 4 -17 11 -12 22 29 70 44 115 39 120 -3 3 -6 3 -8 1
-17 -24 -69 -80 -65 -69 4 8 36 82 73 164 36 82 64 154 62 159 -1 5 -39 -35
-84 -89 -136 -166 -174 -189 -108 -64 20 40 34 74 31 77 -3 3 -38 -6 -78 -20
l-73 -27 -23 26 -23 26 28 21 c40 29 93 80 93 88 0 4 -36 -4 -81 -18 -110 -34
-116 -23 -39 68 69 82 160 216 160 238 0 21 -41 7 -170 -57 -63 -31 -118 -58
-122 -60 -4 -2 -1 18 7 45 23 76 21 77 -46 42 l-61 -33 -19 25 c-25 33 -24 41
12 75 42 39 119 148 119 167 0 14 -8 14 -67 -3 -38 -10 -88 -26 -112 -34 -24
-9 -45 -16 -46 -16 -2 0 6 23 16 51 11 28 18 54 15 56 -3 3 -25 -6 -50 -20
-26 -14 -46 -24 -46 -22 0 2 27 54 61 116 70 128 143 305 135 326 -9 22 -46
-8 -215 -173 l-148 -143 -27 28 -27 28 70 112 c62 101 91 164 79 177 -3 2 -61
-34 -131 -80 -69 -46 -128 -82 -130 -79 -3 2 8 27 24 56 58 108 131 318 116
333 -10 10 -33 -10 -90 -75 -36 -41 -76 -75 -116 -96 l-60 -32 -3 31 c-3 27 7
40 82 112 91 86 259 228 484 411 169 136 265 183 575 281 l206 65 180 6 c143
5 187 10 215 24 l35 18 24 -28 c59 -69 103 -114 108 -109 3 3 -16 44 -41 92
l-46 86 29 33 c38 44 63 114 96 266 48 220 68 272 220 569 l146 285 172 221
c148 189 203 251 392 435 121 118 240 230 265 249 25 19 140 110 257 203 l212
168 197 89 c108 50 243 113 301 142 l105 53 54 -58 c30 -32 68 -82 84 -110
l30 -52 0 45 c0 61 -43 134 -118 199 -39 34 -83 88 -128 159 -37 59 -117 181
-177 271 -102 152 -115 178 -204 400 -53 130 -100 254 -105 275 -13 58 -65
415 -78 536 -6 58 -25 202 -42 320 -29 207 -30 229 -32 585 l-1 370 33 140
c18 77 36 170 39 208 7 77 0 74 116 52 43 -8 88 -15 100 -15 20 1 20 3 -8 25
-32 27 -94 50 -161 60 -34 5 -44 12 -57 40 -20 42 -66 72 -217 139 -134 60
-152 72 -319 215 -107 91 -134 122 -240 266 l-118 164 -61 188 c-38 116 -75
259 -98 373 -36 181 -36 188 -29 341 3 86 8 165 10 175 2 11 4 40 4 65 l1 45
85 33 c86 34 98 44 69 55 -24 9 -41 7 -149 -23z m-3401 -10546 c49 -55 135
-146 190 -202 55 -57 95 -103 88 -103 -15 0 -256 52 -367 80 -44 10 -102 22
-128 25 -32 4 -47 11 -44 18 45 104 79 198 98 266 l23 84 25 -34 c15 -18 66
-79 115 -134z m-326 -542 c56 -20 70 -28 58 -35 -9 -5 -26 -28 -37 -50 l-21
-42 -24 51 c-14 28 -36 58 -50 67 -13 10 -22 21 -19 26 9 14 11 13 93 -17z
m-548 -297 c0 -21 -25 -37 -45 -30 -16 6 -15 9 6 25 29 22 39 24 39 5z"/>
</g>
	</svg>
{:else}
<svg
	width={size}
	height={size}
	viewBox="0 0 48 48"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	aria-hidden="true"
>
	{#if kind === 'attack'}
		{#if element === 'fire'}
			<!-- Chama -->
			<path d="M24 42 C14 42 9 33 11 24 C13 16 18 11 21 8 C20 15 23 20 25 22 C23 16 26 9 24 6 C30 10 34 17 36 25 C38 33 33 42 24 42 Z" fill={color} opacity="0.22" />
			<path d="M24 42 C14 42 9 33 11 24 C13 16 18 11 21 8 C20 15 23 20 25 22 C23 16 26 9 24 6 C30 10 34 17 36 25 C38 33 33 42 24 42 Z" stroke={color} stroke-width="3" stroke-linejoin="round" fill="none" />
			<path d="M24 35 C19 30 20 22 24 18" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.55" />
		{:else if element === 'water'}
			<!-- Gota -->
			<path d="M24 6 C24 6 38 22 38 30 A14 14 0 0 1 10 30 C10 22 24 6 24 6 Z" fill={color} opacity="0.22" />
			<path d="M24 6 C24 6 38 22 38 30 A14 14 0 0 1 10 30 C10 22 24 6 24 6 Z" stroke={color} stroke-width="3" stroke-linejoin="round" fill="none" />
			<path d="M16 30 Q20 25 24 30 Q28 35 32 30" stroke="white" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.55" />
		{:else if element === 'grass'}
			<!-- Folha -->
			<path d="M10 40 C10 40 12 22 20 16 C28 10 40 8 40 8 C40 8 38 20 30 28 C22 36 10 40 10 40 Z" fill={color} opacity="0.22" />
			<path d="M10 40 C10 40 12 22 20 16 C28 10 40 8 40 8 C40 8 38 20 30 28 C22 36 10 40 10 40 Z" stroke={color} stroke-width="3" stroke-linejoin="round" fill="none" />
			<path d="M10 40 L30 17" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.55" />
			<path d="M10 40 L10 45" stroke={color} stroke-width="3" stroke-linecap="round" />
		{:else if element === 'electric'}
			<!-- Raio -->
			<circle cx="24" cy="24" r="16" fill={color} opacity="0.12" />
			<path d="M28 6 L15 27 L22 27 L20 42 L33 21 L26 21 Z" fill={color} opacity="0.22" />
			<path d="M28 6 L15 27 L22 27 L20 42 L33 21 L26 21 Z" stroke={color} stroke-width="3" stroke-linejoin="round" fill="none" />
			<path d="M26 11 L18 24 L23 24" stroke="white" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.55" />
		{:else if element === 'psychic'}
			<!-- Olho -->
			<path d="M8 24 Q16 12 24 12 Q32 12 40 24 Q32 36 24 36 Q16 36 8 24 Z" fill={color} opacity="0.22" />
			<path d="M8 24 Q16 12 24 12 Q32 12 40 24 Q32 36 24 36 Q16 36 8 24 Z" stroke={color} stroke-width="3" stroke-linejoin="round" fill="none" />
			<circle cx="24" cy="24" r="6" fill={color} opacity="0.3" />
			<circle cx="24" cy="24" r="6" stroke={color} stroke-width="3" fill="none" />
			<circle cx="24" cy="24" r="2.5" fill="white" opacity="0.55" />
		{:else if element === 'rock'}
			<!-- Cristal -->
			<path d="M24 5 L39 19 L32 43 L16 43 L9 19 Z" fill={color} opacity="0.22" />
			<path d="M24 5 L39 19 L32 43 L16 43 L9 19 Z" stroke={color} stroke-width="3" stroke-linejoin="round" fill="none" />
			<path d="M24 5 L9 19 L18 43" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.55" />
		{:else}
			<!-- espada (fallback: ataques sem elemento) -->
			<g transform="translate(5 5) scale(2)">
				<path d="M9.646 14.096a1 1 0 1 1-1.414 1.414l-1.414-1.414-2.828 2.829a1 1 0 0 1-1.415 1.414l-1.414-1.414a1 1 0 0 1 1.414-1.415l2.829-2.828-1.414-1.414a1 1 0 0 1 1.414-1.414l4.242 4.242zm.708-.707L6.11 9.146 14.596.661l3.536.707.707 3.536-8.485 8.485z" fill={color} />
				<path d="M10.354 13.389L6.11 9.146 14.596.661" stroke="white" stroke-width="0.65" opacity="0.55" />
			</g>
		{/if}
	{:else if id === 'def_fire_barriage'}
		<!-- barricade flame -->
		<path d="M24 6l14 5v10c0 9-6 15.5-14 19-8-3.5-14-10-14-19V11l14-5z" fill={color} opacity="0.22" />
		<path d="M24 6l14 5v10c0 9-6 15.5-14 19-8-3.5-14-10-14-19V11l14-5z" stroke={color} stroke-width="3" stroke-linejoin="round" fill="none" />
		<path d="M24 14c-3 3-4 5-4 8 0 3 2 6 4 8 2-2 4-5 4-8 0-3-1-5-4-8z" fill={color} opacity="0.35" />
		<path d="M24 14c-3 3-4 5-4 8 0 3 2 6 4 8 2-2 4-5 4-8 0-3-1-5-4-8z" stroke={color} stroke-width="3" stroke-linejoin="round" fill="none" />
		<path d="M14 18l-3-2M34 18l3-2M13 30l-4 1M35 30l4 1" stroke={color} stroke-width="2.5" stroke-linecap="round" opacity="0.8" />
	{:else if id === 'def_ice_barriage'}
		<!-- barricade ice -->
		<path d="M24 6l14 5v10c0 9-6 15.5-14 19-8-3.5-14-10-14-19V11l14-5z" fill={color} opacity="0.22" />
		<path d="M24 6l14 5v10c0 9-6 15.5-14 19-8-3.5-14-10-14-19V11l14-5z" stroke={color} stroke-width="3" stroke-linejoin="round" fill="none" />
		<path d="M24 14v16M16 22h16M18.5 16.5l11 11M29.5 16.5l-11 11" stroke={color} stroke-width="2.5" stroke-linecap="round" opacity="0.9" />
		<circle cx="24" cy="22" r="3.5" fill={color} opacity="0.35" />
		<circle cx="24" cy="22" r="3.5" stroke={color} stroke-width="2.5" fill="none" />
	{:else if id === 'def_rock_barriage'}
		<!-- barricade rock -->
		<path d="M24 6l14 5v10c0 9-6 15.5-14 19-8-3.5-14-10-14-19V11l14-5z" fill={color} opacity="0.22" />
		<path d="M24 6l14 5v10c0 9-6 15.5-14 19-8-3.5-14-10-14-19V11l14-5z" stroke={color} stroke-width="3" stroke-linejoin="round" fill="none" />
		<path d="M14 26l10-8 10 8-10 9-10-9z" fill={color} opacity="0.3" />
		<path d="M14 26l10-8 10 8-10 9-10-9z" stroke={color} stroke-width="3" stroke-linejoin="round" fill="none" />
		<path d="M18 24l6-4 6 4M18 30l6-4 6 4" stroke={color} stroke-width="2.5" stroke-linecap="round" opacity="0.75" />
	{:else if id === 'def_psyche_barriage'}
		<!-- barricade psyche -->
		<path d="M24 6l14 5v10c0 9-6 15.5-14 19-8-3.5-14-10-14-19V11l14-5z" fill={color} opacity="0.22" />
		<path d="M24 6l14 5v10c0 9-6 15.5-14 19-8-3.5-14-10-14-19V11l14-5z" stroke={color} stroke-width="3" stroke-linejoin="round" fill="none" />
		<path d="M24 14c-5 0-9 4-9 8s4 8 9 8 9-4 9-8-4-8-9-8z" fill={color} opacity="0.28" />
		<path d="M24 14c-5 0-9 4-9 8s4 8 9 8 9-4 9-8-4-8-9-8z" stroke={color} stroke-width="3" stroke-linejoin="round" fill="none" />
		<circle cx="24" cy="22" r="2.5" fill={color} opacity="0.6" />
		<path d="M19 22c2-4 8-4 10 0" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.55" />
	{:else if kind === 'defense'}
		<!-- escudo -->
		<path
			d="M24 6l14 5v10c0 9-6 15.5-14 19-8-3.5-14-10-14-19V11l14-5z"
			fill={color}
			opacity="0.25"
		/>
		<path
			d="M24 6l14 5v10c0 9-6 15.5-14 19-8-3.5-14-10-14-19V11l14-5z"
			stroke={color}
			stroke-width="3"
			stroke-linejoin="round"
		/>
		<path d="M18 23l4 4 8-9" stroke={color} stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
	{:else if kind === 'heal'}
		<!-- coração com cruz -->
		<path
			d="M24 40S8 30 8 18a8 8 0 0114-5 8 8 0 0114 5c0 12-16 22-16 22z"
			fill={color}
			opacity="0.22"
		/>
		<path
			d="M24 40S8 30 8 18a8 8 0 0114-5 8 8 0 0114 5c0 12-16 22-16 22z"
			stroke={color}
			stroke-width="3"
			stroke-linejoin="round"
		/>
		<path d="M24 16v10M19 21h10" stroke={color} stroke-width="3" stroke-linecap="round" />
	{:else if kind === 'capture'}
		<!-- pokébola -->
		<circle cx="24" cy="24" r="16" fill="#fff" />
		<path d="M8 24a16 16 0 0132 0H8z" fill={color} />
		<path d="M8 24h32" stroke="#1c1917" stroke-width="3" />
		<circle cx="24" cy="24" r="5.5" fill="#fff" stroke="#1c1917" stroke-width="3" />
		<circle cx="24" cy="24" r="16" stroke="#1c1917" stroke-width="3" />
	{:else if kind === 'buff'}
		<!-- chevrons para cima + brilho -->
		<path
			d="M14 30l10-10 10 10"
			stroke={color}
			stroke-width="3.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
		<path
			d="M14 38l10-10 10 10"
			stroke={color}
			stroke-width="3.5"
			stroke-linecap="round"
			stroke-linejoin="round"
			opacity="0.45"
		/>
		<path
			d="M24 6l1.5 4L30 11.5 25.5 13 24 17l-1.5-4L18 11.5 22.5 10 24 6z"
			fill={color}
		/>
	{:else if kind === 'combo'}
		<!-- vínculo parental: duplo / triplo golpe diagonal -->
		<path d="M9 8 L21 40"  stroke={color} stroke-width="4" stroke-linecap="round" opacity="0.22" />
		<path d="M22 8 L34 40" stroke={color} stroke-width="4" stroke-linecap="round" opacity="0.22" />
		<path d="M9 8 L21 40"  stroke={color} stroke-width="3.5" stroke-linecap="round" />
		<path d="M22 8 L34 40" stroke={color} stroke-width="3.5" stroke-linecap="round" />
		<!-- guard marks at top of each blade -->
		<path d="M5 16 L13 12" stroke={color} stroke-width="2.5" stroke-linecap="round" />
		<path d="M18 16 L26 12" stroke={color} stroke-width="2.5" stroke-linecap="round" />
		<!-- white accent on first slash -->
		<path d="M11 12 L15 24" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.55" />
	{:else if kind === 'energy'}
		<!-- raio de energia -->
		<path d="M25 5 L12 26 L22 26 L23 44 L36 23 L26 23 Z" fill={color} opacity="0.22" />
		<path d="M25 5 L12 26 L22 26 L23 44 L36 23 L26 23 Z" stroke={color} stroke-width="3" stroke-linejoin="round" />
		<path d="M22 13 L16 24 L22 24" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.55" />
	{:else if kind === 'relic'}
		<!-- forma fantasma: silhueta de fantasma -->
		<path
			d="M12 40 L12 22 A12 12 0 0 1 36 22 L36 40 Q33 35 30 40 Q27 35 24 40 Q21 35 18 40 Q15 35 12 40 Z"
			fill={color}
			opacity="0.22"
		/>
		<path
			d="M12 40 L12 22 A12 12 0 0 1 36 22 L36 40 Q33 35 30 40 Q27 35 24 40 Q21 35 18 40 Q15 35 12 40 Z"
			stroke={color}
			stroke-width="3"
			stroke-linejoin="round"
		/>
		<!-- olhos -->
		<circle cx="19" cy="27" r="3.5" fill={color} />
		<circle cx="29" cy="27" r="3.5" fill={color} />
		<!-- brilho no topo -->
		<path d="M20 20 A6 5 0 0 1 28 18" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.55" />
	{:else if kind === 'power'}
		{#if id === 'power_electric_shock'}
			<!-- choque elétrico: núcleo energizado com arco estático -->
			<circle cx="24" cy="24" r="13" fill={color} opacity="0.22" />
			<circle cx="24" cy="24" r="13" stroke={color} stroke-width="3" />
			<path d="M18 15 L13 23 H19 L16 32 L27 19 H21 L24 15 Z" fill={color} opacity="0.22" />
			<path d="M18 15 L13 23 H19 L16 32 L27 19 H21 L24 15 Z" stroke={color} stroke-width="3" stroke-linejoin="round" fill="none" />
			<path d="M31 16 L28 21 H32 L29 28" stroke={color} stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.85" />
			<path d="M13 31 C17 36 31 36 35 31" stroke={color} stroke-width="3" stroke-linecap="round" />
			<path d="M20 12 C22 10 26 10 28 12" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.55" />
		{:else}
			<!-- poder: explosão radial com núcleo brilhante -->
			<circle cx="24" cy="24" r="9" fill={color} opacity="0.22" />
			<circle cx="24" cy="24" r="9" stroke={color} stroke-width="3" />
			<!-- 8 raios da explosão -->
			<line x1="24" y1="6"  x2="24" y2="13" stroke={color} stroke-width="3" stroke-linecap="round" />
			<line x1="38" y1="10" x2="33" y2="16" stroke={color} stroke-width="3" stroke-linecap="round" />
			<line x1="42" y1="24" x2="35" y2="24" stroke={color} stroke-width="3" stroke-linecap="round" />
			<line x1="38" y1="38" x2="33" y2="32" stroke={color} stroke-width="3" stroke-linecap="round" />
			<line x1="24" y1="42" x2="24" y2="35" stroke={color} stroke-width="3" stroke-linecap="round" />
			<line x1="10" y1="38" x2="15" y2="32" stroke={color} stroke-width="3" stroke-linecap="round" />
			<line x1="6"  y1="24" x2="13" y2="24" stroke={color} stroke-width="3" stroke-linecap="round" />
			<line x1="10" y1="10" x2="15" y2="16" stroke={color} stroke-width="3" stroke-linecap="round" />
			<!-- brilho central branco -->
			<circle cx="24" cy="24" r="4" fill="white" opacity="0.55" />
		{/if}
	{:else if kind === 'debuff'}
		<!-- intimidate: rosto assustado com olhos arregalados e boca aberta -->
		<!-- base do rosto -->
		<circle cx="24" cy="24" r="9" fill={color} opacity="0.22" />
		<circle cx="24" cy="24" r="9" stroke={color} stroke-width="3" />
		<!-- olho esquerdo: arregalado -->
		<circle cx="16" cy="20" r="2.5" fill={color} opacity="0.55" />
		<circle cx="16" cy="20" r="2.5" stroke={color} stroke-width="2" fill="none" />
		<!-- olho direito: arregalado -->
		<circle cx="32" cy="20" r="2.5" fill={color} opacity="0.55" />
		<circle cx="32" cy="20" r="2.5" stroke={color} stroke-width="2" fill="none" />
		<!-- boca aberta em O -->
		<ellipse cx="24" cy="30" rx="2" ry="3" stroke={color} stroke-width="2" fill="none" stroke-linecap="round" />
		<!-- linhas de movimento/vibração -->
		<path d="M 12 16 Q 10 14 8 15" stroke={color} stroke-width="2" fill="none" stroke-linecap="round" />
		<path d="M 36 16 Q 38 14 40 15" stroke={color} stroke-width="2" fill="none" stroke-linecap="round" />
	{/if}
</svg>
{/if}
