import {Component, ElementRef, viewChild} from '@angular/core';
import {CdkContextMenuTrigger, CdkMenu, CdkMenuItem, CdkMenuTrigger} from '@angular/cdk/menu';

/**
 * @title CDK context menu and CDK menu trigger on the same element.
 *
 * The dashed area has both a context menu and a regular menu trigger. Right-clicking it and then
 * left-clicking it should replace the open menu instead of stacking menus on top of each other.
 */
@Component({
  selector: 'cdk-menu-context-with-trigger-example',
  exportAs: 'cdkMenuContextWithTriggerExample',
  styleUrl: 'cdk-menu-context-with-trigger-example.css',
  templateUrl: 'cdk-menu-context-with-trigger-example.html',
  imports: [CdkContextMenuTrigger, CdkMenu, CdkMenuItem, CdkMenuTrigger],
})
export class CdkMenuContextWithTriggerExample {
  private readonly _contextTrigger = viewChild.required(CdkContextMenuTrigger);
  private readonly _menuTrigger = viewChild.required(CdkMenuTrigger);
  private readonly _target = viewChild.required<ElementRef<HTMLElement>>('repro_target');

  /** Performs the "right-click, then left-click" sequence on the target in one go. */
  reproduce() {
    const {left, top} = this._target().nativeElement.getBoundingClientRect();
    this._contextTrigger().open({x: left + 40, y: top + 40});
    this._menuTrigger().open();
  }
}
