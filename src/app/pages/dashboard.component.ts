import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LedgerService, Transaction } from '../ledger.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  protected readonly ledger = inject(LedgerService);
  private draggedTile: HTMLElement | null = null;

  protected startTileDrag(event: DragEvent): void {
    const tile = event.currentTarget as HTMLElement;
    this.draggedTile = tile;
    tile.classList.add('tile-dragging');
    event.dataTransfer?.setData('text/plain', 'dashboard-tile');
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  protected allowTileDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  protected dropTile(event: DragEvent): void {
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    const parent = target.parentElement;
    if (!this.draggedTile || !parent || this.draggedTile === target || this.draggedTile.parentElement !== parent) return;
    const tiles = [...parent.children];
    const draggedIndex = tiles.indexOf(this.draggedTile);
    const targetIndex = tiles.indexOf(target);
    parent.insertBefore(this.draggedTile, draggedIndex < targetIndex ? target.nextSibling : target);
  }

  protected endTileDrag(): void {
    this.draggedTile?.classList.remove('tile-dragging');
    this.draggedTile = null;
  }
}
