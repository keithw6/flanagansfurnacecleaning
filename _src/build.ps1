# Builds every page in _src/pages into the site root using _src/template.html.
# Guarantees identical header, footer, nav, CSS and NAP across all pages.
# Usage:  powershell -ExecutionPolicy Bypass -File _src\build.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$src  = Join-Path $root '_src'
$enc  = New-Object System.Text.UTF8Encoding($false)

$template = [System.IO.File]::ReadAllText((Join-Path $src 'template.html'))

# ---- the single source of truth for NAP. Change here, rebuild, done. ----
$BIZ = @'
{
"@type":["LocalBusiness","HVACBusiness"],
"@id":"https://flanagansfurnacecleaning.com/#business",
"name":"Flanagan's Furnace & Duct Cleaning Service",
"description":"Owner-operated furnace cleaning and duct cleaning in Calgary, Alberta. BBB Accredited since 1998, flat pricing and no surprise upsells.",
"url":"https://flanagansfurnacecleaning.com/",
"telephone":"+1-403-272-0560",
"email":"[FLANAGANS-EMAIL]",
"logo":"https://flanagansfurnacecleaning.com/flanagans-furnace-cleaning-calgary-logo.svg",
"image":"https://flanagansfurnacecleaning.com/furnace-cleaning-calgary-flanagans.jpg",
"foundingDate":"1998",
"priceRange":"$$",
"currenciesAccepted":"CAD",
"paymentAccepted":"Cash, Debit, Credit Card, e-Transfer",
"address":{
"@type":"PostalAddress",
"streetAddress":"2121 39 Ave NE",
"addressLocality":"Calgary",
"addressRegion":"AB",
"postalCode":"T2E 6R7",
"addressCountry":"CA"
},
"geo":{"@type":"GeoCoordinates","latitude":51.0790,"longitude":-114.0075},
"openingHoursSpecification":[
{"@type":"OpeningHoursSpecification","dayOfWeek":["Monday","Tuesday","Wednesday","Thursday","Friday"],"opens":"08:00","closes":"17:00"},
{"@type":"OpeningHoursSpecification","dayOfWeek":"Saturday","opens":"09:00","closes":"15:00"}
],
"areaServed":[
{"@type":"City","name":"Calgary"},
{"@type":"City","name":"Chestermere"},
{"@type":"City","name":"Airdrie"},
{"@type":"City","name":"Strathmore"},
{"@type":"Place","name":"Langdon"}
]
}
'@

function Esc([string]$s){ return $s.Replace('\','\\').Replace('"','\"') }

# Strips tags and entities so visible Q&A text can be reused verbatim in FAQ schema.
function Strip([string]$h){
    $t = [regex]::Replace($h, '<[^>]+>', ' ')
    $t = [System.Net.WebUtility]::HtmlDecode($t)
    return ([regex]::Replace($t, '\s+', ' ')).Trim()
}

$pages = Get-ChildItem (Join-Path $src 'pages') -Filter *.html | Sort-Object Name
$built = 0

foreach ($p in $pages) {
    $raw = [System.IO.File]::ReadAllText($p.FullName)
    if ($raw -notmatch '(?s)^<!--meta\s*\r?\n(.*?)\r?\n-->\r?\n(.*)$') {
        throw "No meta block in $($p.Name)"
    }
    $metaBlock = $matches[1]
    $content   = $matches[2]

    $m = @{}
    foreach ($line in ($metaBlock -split "`n")) {
        $line = $line.Trim()
        if ($line -eq '' ) { continue }
        $i = $line.IndexOf(':')
        if ($i -lt 1) { continue }
        $m[$line.Substring(0,$i).Trim()] = $line.Substring($i+1).Trim()
    }

    $slug  = $p.Name
    $canon = if ($m.ContainsKey('canon')) { $m['canon'] } else { $slug }
    $url   = "https://flanagansfurnacecleaning.com/$canon"

    # ---------- assemble the JSON-LD graph ----------
    $nodes = @($BIZ)

    if ($m.ContainsKey('sname')) {
        $areaJson = if ($m.ContainsKey('area')) {
            '{"@type":"Place","name":"' + (Esc $m['area']) + '"}'
        } else {
            '[{"@type":"City","name":"Calgary"},{"@type":"City","name":"Chestermere"},{"@type":"City","name":"Airdrie"},{"@type":"City","name":"Strathmore"}]'
        }
        $svc = @"
 {
 "@type":"Service",
 "@id":"$url#service",
 "name":"$(Esc $m['sname'])",
 "serviceType":"$(Esc $m['stype'])",
 "description":"$(Esc $m['sdesc'])",
 "provider":{"@id":"https://flanagansfurnacecleaning.com/#business"},
 "areaServed":$areaJson
 }
"@
        $nodes += $svc
    }

    $crumbRef = ''
    if ($m.ContainsKey('bcname')) {
        $items = @('{"@type":"ListItem","position":1,"name":"Home","item":"https://flanagansfurnacecleaning.com/"}')
        $pos = 2
        if ($m.ContainsKey('bcparent')) {
            $pp = $m['bcparent'] -split '\|'
            $items += '{"@type":"ListItem","position":' + $pos + ',"name":"' + (Esc $pp[0]) + '","item":"https://flanagansfurnacecleaning.com/' + $pp[1] + '"}'
            $pos++
        }
        $items += '{"@type":"ListItem","position":' + $pos + ',"name":"' + (Esc $m['bcname']) + '","item":"' + $url + '"}'
        $nodes += "{`n`"@type`":`"BreadcrumbList`",`n`"@id`":`"$url#breadcrumb`",`n`"itemListElement`":[`n" + ($items -join ",`n") + "`n]`n}"
        $crumbRef = ",`n`"breadcrumb`":{`"@id`":`"$url#breadcrumb`"}"
    }

    # FAQ schema is generated from the visible Q&A so the two can never drift apart.
    if ($m.ContainsKey('faqauto')) {
        $qas = [regex]::Matches($content, '(?s)<div class="qa">\s*<h3>(.*?)</h3>(.*?)</div>')
        if ($qas.Count -lt 1) { throw "faqauto set but no .qa blocks found in $($p.Name)" }
        $qItems = @()
        foreach ($q in $qas) {
            $qItems += '{"@type":"Question","name":"' + (Esc (Strip $q.Groups[1].Value)) +
                       '","acceptedAnswer":{"@type":"Answer","text":"' + (Esc (Strip $q.Groups[2].Value)) + '"}}'
        }
        $nodes += "{`n`"@type`":`"FAQPage`",`n`"@id`":`"$url#faq`",`n`"mainEntity`":[`n" + ($qItems -join ",`n") + "`n]`n}"
        Write-Output "  $($p.Name): $($qas.Count) FAQ entries into schema"
    }

    if ($m.ContainsKey('extraschema')) {
        $extraPath = Join-Path $src $m['extraschema']
        $nodes += [System.IO.File]::ReadAllText($extraPath).Trim()
    }

    $nodes += @"
 {
 "@type":"WebPage",
 "@id":"$url#webpage",
 "url":"$url",
 "name":"$(Esc $m['title'])"$crumbRef,
 "isPartOf":{"@type":"WebSite","@id":"https://flanagansfurnacecleaning.com/#website","url":"https://flanagansfurnacecleaning.com/","name":"Flanagan's Furnace & Duct Cleaning Service"},
 "about":{"@id":"https://flanagansfurnacecleaning.com/#business"}
 }
"@

    $schema = "{`n`"@context`":`"https://schema.org`",`n`"@graph`":[`n" + ($nodes -join ",`n") + "`n]`n}"

    $ogdesc = if ($m.ContainsKey('ogdesc')) { $m['ogdesc'] } else { $m['desc'] }

    $out = $template.
        Replace('{{TITLE}}',   $m['title']).
        Replace('{{DESC}}',    $m['desc']).
        Replace('{{OGDESC}}',  $ogdesc).
        Replace('{{CANON}}',   $canon).
        Replace('{{SLUG}}',    $slug).
        Replace('{{CONTENT}}', $content).
        Replace('{{SCHEMA}}',  $schema)

    [System.IO.File]::WriteAllText((Join-Path $root $slug), $out, $enc)
    $built++
}

Write-Output "Built $built pages into $root"
