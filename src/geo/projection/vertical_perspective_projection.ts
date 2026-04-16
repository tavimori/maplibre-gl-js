import type {Context} from '../../webgl/context';
import type {CanonicalTileID} from '../../tile/tile_id';
import {type Mesh} from '../../render/mesh';
import {SubdivisionGranularityExpression, SubdivisionGranularitySetting} from '../../render/subdivision_granularity_settings';
import type {Projection, ProjectionGPUContext, TileMeshUsage} from './projection';
import {type PreparedShader, shaders} from '../../shaders/shaders';
import {createTileMeshWithBuffers, type CreateTileMeshOptions} from '../../util/create_tile_mesh';
import {type EvaluationParameters} from '../../style/evaluation_parameters';

export const VerticalPerspectiveShaderDefine = '#define GLOBE';
export const VerticalPerspectiveShaderVariantKey = 'globe';
export const globeConstants = {
    // Kept for test compatibility; no longer used for atan correction transitions.
    errorTransitionTimeSeconds: 0.5
};

const granularitySettingsGlobe: SubdivisionGranularitySetting = new SubdivisionGranularitySetting({
    fill: new SubdivisionGranularityExpression(128, 2),
    line: new SubdivisionGranularityExpression(512, 0),
    // Always keep at least some subdivision on raster tiles, etc,
    // otherwise they will be visibly warped at high zooms (before mercator transition).
    // This si not needed on fill, because fill geometry tends to already be
    // highly tessellated and granular at high zooms.
    tile: new SubdivisionGranularityExpression(128, 32),
    // Stencil granularity must never be higher than fill granularity,
    // otherwise we would get seams in the oceans at zoom levels where
    // stencil has higher granularity than fill.
    stencil: new SubdivisionGranularityExpression(128, 1),
    circle: 3
});

export class VerticalPerspectiveProjection implements Projection {
    private _tileMeshCache: {[_: string]: Mesh} = {};

    get name(): 'vertical-perspective' {
        return 'vertical-perspective';
    }

    get transitionState(): number {
        return 1;
    }

    get useSubdivision(): boolean {
        return true;
    }

    get shaderVariantName(): string {
        return VerticalPerspectiveShaderVariantKey;
    }

    get shaderDefine(): string {
        return VerticalPerspectiveShaderDefine;
    }

    get shaderPreludeCode(): PreparedShader {
        return shaders.projectionGlobe;
    }

    get vertexShaderPreludeCode(): string {
        return shaders.projectionMercator.vertexSource;
    }

    get subdivisionGranularity(): SubdivisionGranularitySetting {
        return granularitySettingsGlobe;
    }

    get useGlobeControls(): boolean {
        return true;
    }

    public destroy() {
        // Do nothing.
    }

    public updateGPUdependent(_renderContext: ProjectionGPUContext): void {
        // Do nothing.
    }

    private _getMeshKey(options: CreateTileMeshOptions): string {
        return `${options.granularity.toString(36)}_${options.generateBorders ? 'b' : ''}${options.extendToNorthPole ? 'n' : ''}${options.extendToSouthPole ? 's' : ''}`;
    }

    public getMeshFromTileID(context: Context, canonical: CanonicalTileID, hasBorder: boolean, allowPoles: boolean, usage: TileMeshUsage): Mesh {
        // Stencil granularity must match fill granularity
        const granularityConfig = usage === 'stencil' ? granularitySettingsGlobe.stencil : granularitySettingsGlobe.tile;
        const granularity = granularityConfig.getGranularityForZoomLevel(canonical.z);
        const north = (canonical.y === 0) && allowPoles;
        const south = (canonical.y === (1 << canonical.z) - 1) && allowPoles;
        return this._getMesh(context, {
            granularity,
            generateBorders: hasBorder,
            extendToNorthPole: north,
            extendToSouthPole: south,
        });
    }

    private _getMesh(context: Context, options: CreateTileMeshOptions): Mesh {
        const key = this._getMeshKey(options);

        if (key in this._tileMeshCache) {
            return this._tileMeshCache[key];
        }

        const mesh = createTileMeshWithBuffers(context, options);
        this._tileMeshCache[key] = mesh;
        return mesh;
    }

    recalculate(_params: EvaluationParameters): void {
        // Do nothing.
    }

    hasTransition(): boolean {
        return false;
    }

}