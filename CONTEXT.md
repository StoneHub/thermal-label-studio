# Thermal Label Studio

Thermal Label Studio is a local workspace where people and agents create labels, review their rendered form, and prepare them for delivery to printers managed elsewhere.

## Language

**LabelDocument**:
The editable label, including its dimensions and ordered content.
_Avoid_: LabelTemplate, canvas state

**Template**:
A reusable starting point for creating a LabelDocument.
_Avoid_: saved label, preset

**RenderArtifact**:
An immutable rendered form of a specific LabelDocument revision, suitable for preview or later print preparation.
_Avoid_: export, output image

**ImportedArtwork**:
Raster content brought into a LabelDocument from an image, clipboard item, or document page.
_Avoid_: asset blob, uploaded file

**PrinterProfile**:
A description of a printer's supported media, dimensions, resolution, and delivery capabilities.
_Avoid_: printer config, host and port

**PrintIntent**:
An explicit request to deliver a particular RenderArtifact to a selected PrinterProfile with stated options such as copy count.
_Avoid_: print job, quick print

**TransportReceipt**:
Evidence that a printer-facing system accepted or rejected a PrintIntent. It does not prove that a physical label printed.
_Avoid_: print success, done

**PhysicalObservation**:
Human or sensor evidence about the physical label produced by a printer.
_Avoid_: delivery receipt, queue result
